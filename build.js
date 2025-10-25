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

    // 2. Calcola la canzone del giorno (LOGICA AGGIORNATA E ROBUSTA)
    const now = new Date();
    // Calcola l'inizio dell'anno corrente in UTC
    const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 0);
    // Calcola la data odierna in UTC (solo giorno, senza ore/minuti)
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    const oneDay = 1000 * 60 * 60 * 24;
    // Calcola il giorno dell'anno (es. 1 per il 1° Gen, 365 per il 31 Dic)
    const dayOfYear = Math.floor((today - startOfYear) / oneDay);

    // Usa il modulo (%) per scegliere un indice
    // (dayOfYear - 1) perché i giorni sono 1-based, ma gli array 0-based
    const songIndex = (dayOfYear - 1) % totalSongs;
    const song = songs[songIndex];

    console.log(`Oggi è il giorno ${dayOfYear} dell'anno (UTC).`);
    console.log(`Canzone selezionata (indice ${songIndex}): "${song.title}"`);
    console.log(`ID YouTube: ${song.youtubeId}`);

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