document.addEventListener('DOMContentLoaded', () => {
    const downloadButton = document.getElementById('downloadgame');
    if (!downloadButton) {
        console.error('not found');
        return;
    }

    downloadButton.addEventListener('click', () => {
        const gameFrame = document.getElementById('gameframe');
        if (!gameFrame || !gameFrame.src) {
            alert('no game to download');
            console.error('not found');
            return;
        }

        let gameUrl = gameFrame.src;

        try {
            if (gameUrl.includes('iframe.html?url=')) {
                const urlParam = new URL(gameUrl).searchParams.get('url');
                if (urlParam) {
                    gameUrl = new URL(urlParam, window.location.origin).href;
                }
            }
        } catch (error) {
            console.error('Error parsing game URL:', error);
            alert('failed');
            return;
        }

        if (!gameUrl || gameUrl.includes('/404.html')) {
            alert('no game');
            return;
        }

        const gameName = getGameNameFromUrl(gameUrl);

        const htmlContent = createHtmlContent(gameUrl, gameName);

        downloadFile(`${gameName}.html`, htmlContent, 'text/html');
    });
});

/**
 * @param {string} url 
 * @returns {string}
 */
function getGameNameFromUrl(url) {
    const urlParts = url.split('/').filter(Boolean);
    const lastPart = urlParts.pop();

    if (lastPart && lastPart !== 'index.html' && lastPart.includes('.')) {
        return lastPart.split('.')[0];
    }

    const secondToLast = urlParts.pop();
    if (secondToLast) {
        return secondToLast;
    }

    return 'game';
}

/**
 * @param {string} gameUrl
 * @param {string} gameName 
 * @returns {string} 
 */
function createHtmlContent(gameUrl, gameName) {
    const originUrl = window.location.origin;
    const logoUrl = `${originUrl}/png/logo.png`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${gameName} - Truffled</title>
<style>
html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
}
iframe {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    border: none;
}
#game-logo {
    position: fixed;
    bottom: 10px;
    right: 10px;
    width: 150px;
    height: 150px;
    cursor: pointer;
    z-index: 9999;
}
</style>
</head>
<body>
<iframe src="${gameUrl}" allowfullscreen></iframe>
<a href="${originUrl}" target="_blank">
    <img id="game-logo" src="${logoUrl}" alt="Logo">
</a>

</body>
</html>`;
}

/**
 * @param {string} filename 
 * @param {string} content 
 * @param {string} mimeType 
 */
function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link); 
    link.click();
    document.body.removeChild(link); 
    URL.revokeObjectURL(link.href);
}

const htmlWithRemovedAnalytics = `<!DOCTYPE html>
<html lang="en">
<head>...</head>
<body>
    ...
    </body>
</html>`;