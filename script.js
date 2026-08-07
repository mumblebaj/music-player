const image = document.querySelector('img');
const title = document.getElementById('title');
const artist = document.getElementById('artist');
const music = document.querySelector('audio');
const progressContainer = document.getElementById('progress-container');
const progress = document.getElementById('progress');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const prevBtn = document.getElementById('prev');
const playBtn = document.getElementById('play');
const nextBtn = document.getElementById('next');
const importBtn = document.getElementById('import-btn');
const importFolderBtn = document.getElementById('import-folder-btn');
const clearBtn = document.getElementById('clear-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const fileInput = document.getElementById('file-input');
const folderInput = document.getElementById('folder-input');
const queueInfo = document.getElementById('queue-info');
const queueList = document.getElementById('queue-list');

const audioExtensions = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']);
const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const genericCoverNames = new Set(['cover', 'folder', 'front', 'album', 'albumart']);
const defaultCover = image.src;
const themeStorageKey = 'musicPlayerTheme';

let songs = [];
let songIndex = 0;
let isPlaying = false;
const managedObjectUrls = new Set();

function setTheme(mode) {
    const darkModeEnabled = mode === 'dark';
    document.body.classList.toggle('theme-dark', darkModeEnabled);

    if (themeToggleBtn) {
        const icon = themeToggleBtn.querySelector('i');
        if (icon) {
            icon.className = darkModeEnabled ? 'fas fa-sun' : 'fas fa-moon';
        }

        const nextModeLabel = darkModeEnabled ? 'light' : 'dark';
        themeToggleBtn.setAttribute('title', `Switch to ${nextModeLabel} mode`);
        themeToggleBtn.setAttribute('aria-label', `Switch to ${nextModeLabel} mode`);
    }

    localStorage.setItem(themeStorageKey, darkModeEnabled ? 'dark' : 'light');
}

function initializeTheme() {
    const savedTheme = localStorage.getItem(themeStorageKey);
    if (savedTheme === 'dark' || savedTheme === 'light') {
        setTheme(savedTheme);
        return;
    }

    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
}

function hasSongs() {
    return songs.length > 0;
}

function updateQueueInfo() {
    const count = songs.length;
    const label = count === 1 ? 'song' : 'songs';

    if (count === 0) {
        queueInfo.textContent = `Queue: ${count} ${label}`;
        return;
    }

    queueInfo.textContent = `Queue: ${count} ${label} | Now Playing: ${songIndex + 1}/${count}`;
}

function renderQueue() {
    queueList.innerHTML = '';

    songs.forEach((song, index) => {
        const item = document.createElement('li');
        const button = document.createElement('button');
        const itemTitle = document.createElement('span');
        const itemArtist = document.createElement('span');

        button.type = 'button';
        button.className = 'queue-item';
        if (index === songIndex && hasSongs()) {
            button.classList.add('active');
        }

        itemTitle.className = 'queue-item-title';
        itemTitle.textContent = song.displayName;
        itemArtist.className = 'queue-item-artist';
        itemArtist.textContent = song.artist;

        button.append(itemTitle, itemArtist);
        button.addEventListener('click', () => {
            songIndex = index;
            loadSong(songs[songIndex]);
            renderQueue();
            playSong();
        });

        item.appendChild(button);
        queueList.appendChild(item);
    });
}

function updatePlayButton(isPaused) {
    if (isPaused) {
        playBtn.classList.replace('fa-pause', 'fa-play');
        playBtn.setAttribute('title', 'Play');
        return;
    }

    playBtn.classList.replace('fa-play', 'fa-pause');
    playBtn.setAttribute('title', 'Pause');
}

function resetTimeDisplay() {
    progress.style.width = '0%';
    currentTimeEl.textContent = '0:00';
    durationEl.textContent = '0:00';
}

function renderEmptyState() {
    title.textContent = 'Select Local Songs';
    artist.textContent = 'No file loaded';
    image.src = defaultCover;
    music.removeAttribute('src');
    music.load();
    resetTimeDisplay();
}

function parseDisplayName(fileName) {
    const dotIndex = fileName.lastIndexOf('.');
    const withoutExt = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
    return withoutExt.replace(/[_-]+/g, ' ').trim() || fileName;
}

function createManagedObjectUrl(blob) {
    const url = URL.createObjectURL(blob);
    managedObjectUrls.add(url);
    return url;
}

function revokeAllManagedObjectUrls() {
    managedObjectUrls.forEach(url => URL.revokeObjectURL(url));
    managedObjectUrls.clear();
}

function getBaseName(fileName) {
    const dotIndex = fileName.lastIndexOf('.');
    return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}

function getDirectoryKey(file) {
    const relativePath = file.webkitRelativePath || '';
    if (!relativePath) {
        return '';
    }

    const parts = relativePath.split('/');
    parts.pop();
    return parts.join('/').toLowerCase();
}

function createPictureObjectUrl(pictureTag) {
    if (!pictureTag || !pictureTag.data || !pictureTag.data.length) {
        return null;
    }

    try {
        const byteArray = new Uint8Array(pictureTag.data);
        const mimeType = pictureTag.format && pictureTag.format.startsWith('image/')
            ? pictureTag.format
            : 'image/jpeg';
        const pictureBlob = new Blob([byteArray], { type: mimeType });
        return createManagedObjectUrl(pictureBlob);
    } catch (error) {
        console.warn('Unable to parse album art, using default cover.', error);
        return null;
    }
}

function readMetadata(file) {
    return new Promise(resolve => {
        if (!window.jsmediatags) {
            resolve(null);
            return;
        }

        window.jsmediatags.read(file, {
            onSuccess: ({ tags }) => {
                const metadata = {
                    title: tags.title || null,
                    artist: tags.artist || null,
                    coverUrl: createPictureObjectUrl(tags.picture)
                };
                resolve(metadata);
            },
            onError: () => {
                resolve(null);
            }
        });
    });
}

function canPlayFile(file) {
    if (file.type && file.type.startsWith('audio/')) {
        return true;
    }

    const extension = file.name.split('.').pop();
    return extension ? audioExtensions.has(extension.toLowerCase()) : false;
}

function isImageFile(file) {
    if (file.type && file.type.startsWith('image/')) {
        return true;
    }

    const extension = file.name.split('.').pop();
    return extension ? imageExtensions.has(extension.toLowerCase()) : false;
}

function buildImageIndex(files) {
    const imageIndex = new Map();

    files.filter(isImageFile).forEach(file => {
        const directoryKey = getDirectoryKey(file);
        const baseName = getBaseName(file.name).toLowerCase();
        const exactKey = `${directoryKey}::${baseName}`;

        if (!imageIndex.has(exactKey)) {
            imageIndex.set(exactKey, createManagedObjectUrl(file));
        }

        if (genericCoverNames.has(baseName)) {
            const genericKey = `${directoryKey}::__generic__`;
            if (!imageIndex.has(genericKey)) {
                imageIndex.set(genericKey, imageIndex.get(exactKey));
            }
        }
    });

    return imageIndex;
}

function resolveSidecarCover(file, imageIndex) {
    const directoryKey = getDirectoryKey(file);
    const baseName = getBaseName(file.name).toLowerCase();
    const exactMatch = imageIndex.get(`${directoryKey}::${baseName}`);
    if (exactMatch) {
        return exactMatch;
    }

    const genericMatch = imageIndex.get(`${directoryKey}::__generic__`);
    return genericMatch || null;
}

async function createSongFromFile(file, sidecarCoverUrl) {
    const objectUrl = createManagedObjectUrl(file);
    const metadata = await readMetadata(file);
    const resolvedCover = metadata?.coverUrl || sidecarCoverUrl || defaultCover;

    return {
        displayName: metadata?.title || parseDisplayName(file.name),
        artist: metadata?.artist || 'Local File',
        src: objectUrl,
        cover: resolvedCover,
        isObjectUrl: true
    };
}

function loadSong(song) {
    title.textContent = song.displayName;
    artist.textContent = song.artist;
    image.src = song.cover || defaultCover;
    music.src = song.src;
    resetTimeDisplay();
    updateQueueInfo();
}

async function playSong() {
    if (!hasSongs()) {
        return;
    }

    try {
        await music.play();
        isPlaying = true;
        updatePlayButton(false);
    } catch (error) {
        isPlaying = false;
        updatePlayButton(true);
        console.error('Unable to play selected file:', error);
    }
}

function pauseSong() {
    isPlaying = false;
    updatePlayButton(true);
    music.pause();
}

function prevSong() {
    if (!hasSongs()) {
        return;
    }

    songIndex = (songIndex - 1 + songs.length) % songs.length;
    loadSong(songs[songIndex]);
    renderQueue();
    playSong();
}

function nextSong() {
    if (!hasSongs()) {
        return;
    }

    songIndex = (songIndex + 1) % songs.length;
    loadSong(songs[songIndex]);
    renderQueue();
    playSong();
}

function updateProgressBar(e) {
    const { duration, currentTime } = e.srcElement;

    if (!Number.isFinite(duration) || duration <= 0) {
        return;
    }

    const progressPercent = (currentTime / duration) * 100;
    progress.style.width = `${progressPercent}%`;

    const durationMinutes = Math.floor(duration / 60);
    let durationSeconds = Math.floor(duration % 60);
    if (durationSeconds < 10) {
        durationSeconds = `0${durationSeconds}`;
    }
    durationEl.textContent = `${durationMinutes}:${durationSeconds}`;

    const currentMinutes = Math.floor(currentTime / 60);
    let currentSeconds = Math.floor(currentTime % 60);
    if (currentSeconds < 10) {
        currentSeconds = `0${currentSeconds}`;
    }
    currentTimeEl.textContent = `${currentMinutes}:${currentSeconds}`;
}

function setProgressBar(e) {
    const { duration } = music;
    if (!Number.isFinite(duration) || duration <= 0) {
        return;
    }

    const width = progressContainer.clientWidth;
    const clickX = e.offsetX;
    music.currentTime = (clickX / width) * duration;
}

function clearQueue() {
    pauseSong();

    songs = [];
    songIndex = 0;
    revokeAllManagedObjectUrls();
    updateQueueInfo();
    renderQueue();
    renderEmptyState();
}

async function handleFileSelection(e) {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) {
        return;
    }

    const imageIndex = buildImageIndex(selectedFiles);
    const validFiles = selectedFiles.filter(canPlayFile);
    const validSongs = await Promise.all(
        validFiles.map(file => createSongFromFile(file, resolveSidecarCover(file, imageIndex)))
    );
    if (validSongs.length === 0) {
        console.warn('No supported audio files selected.');
        fileInput.value = '';
        return;
    }

    const wasEmpty = !hasSongs();
    songs.push(...validSongs);
    updateQueueInfo();
    renderQueue();

    if (wasEmpty) {
        songIndex = 0;
        loadSong(songs[songIndex]);
        renderQueue();
        playSong();
    }

    fileInput.value = '';
}

playBtn.addEventListener('click', () => (isPlaying ? pauseSong() : playSong()));
prevBtn.addEventListener('click', prevSong);
nextBtn.addEventListener('click', nextSong);
music.addEventListener('ended', nextSong);
music.addEventListener('timeupdate', updateProgressBar);
progressContainer.addEventListener('click', setProgressBar);
importBtn.addEventListener('click', () => fileInput.click());
importFolderBtn.addEventListener('click', () => folderInput.click());
clearBtn.addEventListener('click', clearQueue);
fileInput.addEventListener('change', handleFileSelection);
folderInput.addEventListener('change', handleFileSelection);
themeToggleBtn.addEventListener('click', () => {
    const isDark = document.body.classList.contains('theme-dark');
    setTheme(isDark ? 'light' : 'dark');
});

window.addEventListener('beforeunload', () => {
    revokeAllManagedObjectUrls();
});

updateQueueInfo();
renderQueue();
renderEmptyState();
initializeTheme();

image.addEventListener('error', () => {
    image.src = defaultCover;
});
