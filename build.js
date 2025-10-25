const fs = require('fs');
const path = require('path');

// Percorsi dei file
const SONGS_FILE = path.join(__dirname, 'songs.json');
const TEMPLATE_FILE = path.join(__dirname, 'template.html');
const OUTPUT_FILE = path.join(__dirname, 'index.html');

console.log('Avvio della build "Teto: Song of the Day" ...');

try {
    // 1. Leggi il database delle canzoni
    const songsData = fs.readFileSync(SONGS_FILE, 'utf8');
    const songs = JSON.parse(songsData);
    const totalSongs = songs.length;

    if (totalSongs === 0) {
        throw new Error('songs.json è vuoto. Aggiungi almeno una canzone.');
    }

    // 2. Calcola la canzone del giorno
    // Questo metodo usa il "giorno dell'anno" per scegliere una canzone
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    // Usa il modulo (%) per assicurarsi che l'indice sia sempre valido
    const songIndex = (dayOfYear - 1) % totalSongs;
    const song = songs[songIndex];

    console.log(`Giorno ${dayOfYear}, Canzone indice ${songIndex}: "${song.title}"`);

    // 3. Leggi il modello HTML
    const template = fs.readFileSync(TEMPLATE_FILE, 'utf8');

    // 4. Sostituisci i segnaposto
    let outputHtml = template.replace(new RegExp('%%TITLE%%', 'g'), song.title);
    outputHtml = outputHtml.replace(new RegExp('%%ID%%', 'g'), song.youtubeId);

    // 5. Scrivi il file index.html finale
    fs.writeFileSync(OUTPUT_FILE, outputHtml);

    console.log(`Build completata con successo! ${OUTPUT_FILE} è stato generato.`);

} catch (error) {
    console.error('Errore durante il processo di build:', error.message);
    process.exit(1); // Esce con un codice di errore
}