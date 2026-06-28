// Adds example sentences (`ex`), usage notes (`n`), and a separable flag
// (`sep`) to verbs in public/data/verbs.json.
//
// `ex` is an array of "German. — English." strings (em-dash with surrounding
// spaces is the delimiter the detail renderer splits on). For separable verbs
// the examples deliberately show the prefix splitting off in a main clause and
// re-attaching with -ge- in the Perfekt participle.
//
// Run: node scripts/add-verb-examples.mjs
// Idempotent — re-running just overwrites the same fields. Keys not present in
// the map below are left untouched.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "public", "data", "verbs.json");

// ── Separable verbs ────────────────────────────────────────────
const SEPARABLE = {
  "anrufen": {
    ex: ["Ich rufe dich später an. — I'll call you later.", "Ich habe gestern meine Mutter angerufen. — I called my mother yesterday."],
    n: "Separable: 'an' goes to the end in main clauses. Irregular (rief an, angerufen). Takes a direct object (Akkusativ): jemanden anrufen.",
  },
  "aufhören": {
    ex: ["Hör auf! — Stop it!", "Es hat endlich aufgehört zu regnen. — It finally stopped raining."],
    n: "Separable. 'aufhören mit + Dativ' (Hör mit dem Lärm auf) or 'aufhören zu + infinitive'.",
  },
  "einkaufen": {
    ex: ["Ich kaufe am Samstag ein. — I do the shopping on Saturday.", "Hast du schon eingekauft? — Have you done the shopping yet?"],
    n: "Separable. 'einkaufen' = to do (grocery) shopping; 'kaufen' = to buy a specific thing.",
  },
  "aufstehen": {
    ex: ["Ich stehe jeden Morgen um sieben auf. — I get up at seven every morning.", "Heute bin ich früh aufgestanden. — I got up early today."],
    n: "Separable, irregular; takes 'sein' in the Perfekt (change of position).",
  },
  "anfangen": {
    ex: ["Der Film fängt um acht an. — The film starts at eight.", "Wann hast du mit dem Kurs angefangen? — When did you start the course?"],
    n: "Separable, irregular: a→ä (du fängst an). 'anfangen mit + Dativ' or 'anfangen zu + infinitive'.",
  },
  "aufmachen": {
    ex: ["Mach bitte das Fenster auf. — Please open the window.", "Ich habe die Tür aufgemacht. — I opened the door."],
    n: "Separable; colloquial alternative to 'öffnen'. Opposite: 'zumachen'.",
  },
  "vorhaben": {
    ex: ["Was hast du am Wochenende vor? — What are your plans for the weekend?", "Wir hatten viel vor. — We had a lot planned."],
    n: "Separable, conjugates like 'haben' (du hast vor). Means 'to plan / have planned'.",
  },
  "zuhören": {
    ex: ["Hör mir bitte zu! — Please listen to me!", "Sie hat aufmerksam zugehört. — She listened attentively."],
    n: "Separable. Takes the Dativ: jemandem zuhören.",
  },
  "fernsehen": {
    ex: ["Abends sehe ich gern fern. — I like watching TV in the evening.", "Wir haben den ganzen Abend ferngesehen. — We watched TV all evening."],
    n: "Separable, irregular: e→ie (du siehst fern). 'fern' splits off to the end.",
  },
  "vorstellen": {
    ex: ["Ich stelle dir meinen Bruder vor. — I'll introduce my brother to you.", "Sie hat sich kurz vorgestellt. — She introduced herself briefly."],
    n: "Separable. 'sich vorstellen' = to introduce oneself; 'sich (Dativ) etwas vorstellen' = to imagine something.",
  },
  "mitkommen": {
    ex: ["Kommst du mit? — Are you coming along?", "Sie ist nicht mitgekommen. — She didn't come along."],
    n: "Separable, irregular; 'sein' in the Perfekt (movement).",
  },
  "anbieten": {
    ex: ["Darf ich dir einen Kaffee anbieten? — May I offer you a coffee?", "Man hat ihm die Stelle angeboten. — They offered him the job."],
    n: "Separable, irregular (bot an, angeboten). 'jemandem etwas anbieten' (Dativ + Akkusativ).",
  },
  "vorschlagen": {
    ex: ["Ich schlage einen Spaziergang vor. — I suggest a walk.", "Was hast du vorgeschlagen? — What did you suggest?"],
    n: "Separable, irregular: a→ä (du schlägst vor). 'jemandem etwas vorschlagen'.",
  },
  "zusammenwohnen": {
    ex: ["Wir wohnen zusammen. — We live together.", "Sie haben zwei Jahre zusammengewohnt. — They lived together for two years."],
    n: "Separable. 'zusammen' goes to the end of the clause.",
  },
  "aussehen": {
    ex: ["Du siehst müde aus. — You look tired.", "Das Essen hat lecker ausgesehen. — The food looked delicious."],
    n: "Separable, irregular: e→ie (du siehst aus). Means 'to look / appear', followed by an adjective.",
  },
  "hingehen": {
    ex: ["Ich gehe da nicht hin. — I'm not going there.", "Bist du gestern hingegangen? — Did you go (there) yesterday?"],
    n: "Separable; 'sein' in the Perfekt. 'hin' marks motion away from the speaker toward a place.",
  },
  "mitnehmen": {
    ex: ["Nimm einen Schirm mit! — Take an umbrella with you!", "Ich habe das Buch mitgenommen. — I took the book along."],
    n: "Separable, irregular: e→i (du nimmst mit). 'jemanden/etwas mitnehmen' = to take along.",
  },
  "mitgehen": {
    ex: ["Gehst du mit? — Are you going along?", "Er ist mitgegangen. — He went along."],
    n: "Separable; 'sein' in the Perfekt (movement).",
  },
  "einladen": {
    ex: ["Ich lade dich zum Essen ein. — I'm inviting you to dinner.", "Sie hat uns eingeladen. — She invited us."],
    n: "Separable, irregular: a→ä (du lädst ein). 'jemanden zu etwas einladen'.",
  },
  "aufschreiben": {
    ex: ["Schreib dir die Adresse auf! — Write the address down!", "Ich habe alles aufgeschrieben. — I wrote everything down."],
    n: "Separable, irregular (schrieb auf, aufgeschrieben). Means 'to write down / note down'.",
  },
  "aufräumen": {
    ex: ["Räum bitte dein Zimmer auf! — Tidy up your room, please!", "Ich habe die Küche aufgeräumt. — I tidied up the kitchen."],
    n: "Separable. 'aufräumen' = to tidy up / clear away.",
  },
  "mitbringen": {
    ex: ["Bring bitte Brot mit! — Please bring some bread.", "Was hast du mitgebracht? — What did you bring (along)?"],
    n: "Separable, mixed verb (brachte mit, mitgebracht). 'jemandem etwas mitbringen'.",
  },
  "zurückkommen": {
    ex: ["Wann kommst du zurück? — When are you coming back?", "Sie ist spät zurückgekommen. — She came back late."],
    n: "Separable; 'sein' in the Perfekt (movement).",
  },
  "ankommen": {
    ex: ["Der Zug kommt um zehn an. — The train arrives at ten.", "Wir sind pünktlich angekommen. — We arrived on time."],
    n: "Separable, irregular; 'sein' in the Perfekt. Opposite of 'abfahren'. 'ankommen auf + Akk' = to depend on.",
  },
  "losmüssen": {
    ex: ["Ich muss jetzt los. — I have to get going now.", "Wir mussten früh los. — We had to set off early."],
    n: "Separable, colloquial (= sich auf den Weg machen müssen). 'los' splits off: 'Ich muss los.'",
  },
  "weiterfeiern": {
    ex: ["Wir feiern bei mir weiter. — We'll carry on celebrating at my place.", "Sie haben bis spät weitergefeiert. — They kept partying until late."],
    n: "Separable. The prefix 'weiter-' means to keep on doing something.",
  },
  "annehmen": {
    ex: ["Ich nehme das Angebot an. — I accept the offer.", "Er hat die Einladung angenommen. — He accepted the invitation."],
    n: "Separable, irregular: e→i (du nimmst an). Means 'to accept' or 'to assume'.",
  },
  "absagen": {
    ex: ["Ich muss den Termin absagen. — I have to cancel the appointment.", "Sie hat kurzfristig abgesagt. — She cancelled at short notice."],
    n: "Separable. Opposite of 'zusagen'. 'absagen' = to cancel / call off.",
  },
  "reinkommen": {
    ex: ["Komm rein! — Come in!", "Er ist gerade reingekommen. — He just came in."],
    n: "Separable, colloquial for 'hereinkommen'. 'sein' in the Perfekt.",
  },
  "vorbeikommen": {
    ex: ["Komm doch mal vorbei! — Why don't you drop by sometime!", "Sie ist gestern vorbeigekommen. — She dropped by yesterday."],
    n: "Separable; 'sein' in the Perfekt. 'vorbeikommen bei + Dativ' = to drop by someone's.",
  },
  "ansehen": {
    ex: ["Sieh dir das an! — Take a look at this!", "Wir haben uns den Film angesehen. — We watched the film."],
    n: "Separable, irregular: e→ie (du siehst an). 'sich (Dativ) etwas ansehen' = to watch / look at.",
  },
  "losfahren": {
    ex: ["Wir fahren um acht los. — We set off at eight.", "Der Bus ist schon losgefahren. — The bus has already left."],
    n: "Separable, irregular: a→ä (du fährst los); 'sein' in the Perfekt. Means 'to set off / drive off'.",
  },
  "mitmüssen": {
    ex: ["Ich muss leider mit. — Unfortunately I have to come along.", "Die Kinder mussten auch mit. — The kids had to come too."],
    n: "Separable, colloquial (= mitkommen/mitgehen müssen). 'mit' splits off: 'Ich muss mit.'",
  },
  "ablehnen": {
    ex: ["Sie lehnt den Vorschlag ab. — She rejects the proposal.", "Er hat die Stelle abgelehnt. — He turned down the job."],
    n: "Separable. Opposite of 'annehmen'. Means 'to reject / decline'.",
  },
  "aussprechen": {
    ex: ["Wie spricht man dieses Wort aus? — How do you pronounce this word?", "Ich habe den Namen falsch ausgesprochen. — I pronounced the name wrong."],
    n: "Separable, irregular: e→i (du sprichst aus). Means 'to pronounce'.",
  },
  "herunterladen": {
    ex: ["Ich lade die App herunter. — I'm downloading the app.", "Hast du die Datei heruntergeladen? — Have you downloaded the file?"],
    n: "Separable, irregular: a→ä (du lädst herunter). Same meaning as 'downloaden'.",
  },
  "eingeben": {
    ex: ["Gib bitte dein Passwort ein. — Please enter your password.", "Ich habe die Daten eingegeben. — I entered the data."],
    n: "Separable, irregular: e→i (du gibst ein). Means 'to enter / input'.",
  },
  "hochladen": {
    ex: ["Ich lade die Fotos hoch. — I'm uploading the photos.", "Sie hat das Video hochgeladen. — She uploaded the video."],
    n: "Separable, irregular: a→ä (du lädst hoch). Opposite of 'herunterladen'.",
  },
  "auswählen": {
    ex: ["Wähl eine Farbe aus! — Pick a colour!", "Ich habe das Geschenk schon ausgewählt. — I've already chosen the present."],
    n: "Separable. Means 'to select / pick out'.",
  },
  "hinzufügen": {
    ex: ["Füg noch etwas Salz hinzu. — Add a bit more salt.", "Ich habe ihn als Freund hinzugefügt. — I added him as a friend."],
    n: "Separable. 'etwas (Dativ) etwas (Akk) hinzufügen' = to add something to something.",
  },
  "dabeihaben": {
    ex: ["Hast du deinen Ausweis dabei? — Do you have your ID on you?", "Ich hatte kein Geld dabei. — I didn't have any money on me."],
    n: "Separable, conjugates like 'haben'. 'etwas dabeihaben' = to have something with/on you.",
  },
  "ausdrucken": {
    ex: ["Ich drucke das Dokument aus. — I'm printing out the document.", "Sie hat die Tickets ausgedruckt. — She printed out the tickets."],
    n: "Separable. 'ausdrucken' = to print out (don't confuse with 'ausdrücken' = to express / squeeze).",
  },
  "vorbereiten": {
    ex: ["Ich bereite das Essen vor. — I'm preparing the meal.", "Hast du dich auf die Prüfung vorbereitet? — Did you prepare for the exam?"],
    n: "Separable. 'sich auf etwas (Akk) vorbereiten' = to prepare for something.",
  },
  "einräumen": {
    ex: ["Räum bitte die Teller ein. — Please put the plates away.", "Ich habe den Schrank eingeräumt. — I stocked the cupboard."],
    n: "Separable. Means 'to put away / stock'; opposite of 'ausräumen'.",
  },
  "einschalten": {
    ex: ["Schalt das Licht ein! — Switch on the light!", "Ich habe den Fernseher eingeschaltet. — I switched on the TV."],
    n: "Separable. Means 'to switch on'; opposite of 'ausschalten' (and 'anmachen').",
  },
  "rausbringen": {
    ex: ["Bring bitte den Müll raus! — Please take the rubbish out!", "Er hat den Müll rausgebracht. — He took the rubbish out."],
    n: "Separable, mixed (brachte raus, rausgebracht). Colloquial for 'herausbringen'.",
  },
  "aufhängen": {
    ex: ["Häng die Jacke auf! — Hang up the jacket!", "Ich habe die Wäsche aufgehängt. — I hung up the laundry."],
    n: "Separable (regular). Means 'to hang up'.",
  },
  "ausräumen": {
    ex: ["Ich räume die Spülmaschine aus. — I'm emptying the dishwasher.", "Sie hat den Schrank ausgeräumt. — She cleared out the cupboard."],
    n: "Separable. Means 'to empty / clear out'; opposite of 'einräumen'.",
  },
  "zurückrufen": {
    ex: ["Ich rufe dich gleich zurück. — I'll call you right back.", "Hat sie schon zurückgerufen? — Has she called back yet?"],
    n: "Separable, irregular (rief zurück, zurückgerufen). Means 'to call back'.",
  },
  "hinwollen": {
    ex: ["Wo willst du hin? — Where do you want to go?", "Ich wollte da gar nicht hin. — I didn't want to go there at all."],
    n: "Separable, colloquial (= an einen Ort wollen). 'hin' marks direction away from the speaker.",
  },
  "nachfragen": {
    ex: ["Frag im Büro nach! — Ask at the office!", "Ich habe noch einmal nachgefragt. — I asked again / followed up."],
    n: "Separable. Means 'to ask / inquire', often to follow up.",
  },
  "weiterfahren": {
    ex: ["Wir fahren morgen weiter. — We travel on tomorrow.", "Der Zug ist ohne uns weitergefahren. — The train went on without us."],
    n: "Separable, irregular: a→ä (du fährst weiter); 'sein' in the Perfekt. 'weiter-' = to continue.",
  },
  "aufpassen": {
    ex: ["Pass auf! — Watch out!", "Die Babysitterin hat auf die Kinder aufgepasst. — The babysitter looked after the children."],
    n: "Separable. 'aufpassen auf + Akk' = to watch / look after. 'Pass auf!' = Watch out!",
  },
  "anschauen": {
    ex: ["Schau mal die Wolken an! — Look at the clouds!", "Wir haben uns die Bilder angeschaut. — We looked at the pictures."],
    n: "Separable. 'sich etwas anschauen' = to look at / watch (= ansehen, more common in the south).",
  },
  "abnehmen": {
    ex: ["Ich nehme den Hut ab. — I take off my hat.", "Sie hat fünf Kilo abgenommen. — She lost five kilos."],
    n: "Separable, irregular: e→i (du nimmst ab). Means 'to take off', 'to lose weight', or 'to pick up (the phone)'.",
  },
  "zusammendrücken": {
    ex: ["Drück die Teile fest zusammen. — Press the parts firmly together.", "Ich habe den Schwamm zusammengedrückt. — I squeezed the sponge together."],
    n: "Separable. 'zusammen' + 'drücken' = to press / squeeze together.",
  },
  "anprobieren": {
    ex: ["Ich probiere die Schuhe an. — I'm trying on the shoes.", "Hast du das Kleid anprobiert? — Did you try on the dress?"],
    n: "Separable. Means 'to try on' (clothes).",
  },
  "dazuschreiben": {
    ex: ["Schreib bitte das Datum dazu. — Please add the date (in writing).", "Ich habe meinen Namen dazugeschrieben. — I added my name."],
    n: "Separable, irregular (schrieb dazu, dazugeschrieben). 'dazu-' = to add in writing.",
  },
  "abfahren": {
    ex: ["Der Zug fährt in fünf Minuten ab. — The train leaves in five minutes.", "Wir sind schon abgefahren. — We've already left."],
    n: "Separable, irregular: a→ä (du fährst ab); 'sein' in the Perfekt. Opposite of 'ankommen'.",
  },
  "einsteigen": {
    ex: ["Steig schnell ein! — Get in quickly!", "Alle sind eingestiegen. — Everyone got on."],
    n: "Separable, irregular (stieg ein, eingestiegen); 'sein' in the Perfekt. Means 'to get in / board'.",
  },
  "aussteigen": {
    ex: ["Wir steigen an der nächsten Haltestelle aus. — We get off at the next stop.", "Sie ist zu früh ausgestiegen. — She got off too early."],
    n: "Separable, irregular; 'sein' in the Perfekt. Opposite of 'einsteigen'; compare 'umsteigen' = to change.",
  },
  "wegkönnen": {
    ex: ["Ich kann heute nicht weg. — I can't get away today.", "Sie hat gestern nicht weggekonnt. — She couldn't get away yesterday."],
    n: "Separable, colloquial (= weggehen können). 'weg' splits off: 'Ich kann nicht weg.'",
  },
  "losgehen": {
    ex: ["Es geht gleich los! — It's about to start!", "Die Party ist schon losgegangen. — The party has already started."],
    n: "Separable; 'sein' in the Perfekt. Means 'to start / get going / set off'.",
  },
  "abgeben": {
    ex: ["Gib die Hausaufgabe bis Freitag ab. — Hand in the homework by Friday.", "Ich habe den Schlüssel abgegeben. — I handed in the key."],
    n: "Separable, irregular: e→i (du gibst ab). Means 'to hand in / hand over'.",
  },
  "abholen": {
    ex: ["Ich hole dich vom Bahnhof ab. — I'll pick you up from the station.", "Sie hat die Kinder abgeholt. — She picked up the children."],
    n: "Separable. 'jemanden/etwas abholen' = to pick up / collect.",
  },
  "abschließen": {
    ex: ["Schließ bitte die Tür ab! — Please lock the door!", "Ich habe das Fahrrad abgeschlossen. — I locked the bike."],
    n: "Separable, irregular (schloss ab, abgeschlossen). Means 'to lock' or 'to finish / complete'.",
  },
  "anmachen": {
    ex: ["Mach bitte das Licht an. — Please turn on the light.", "Ich habe den Ofen angemacht. — I turned on the oven."],
    n: "Separable, colloquial for 'einschalten'. Opposite: 'ausmachen'.",
  },
  "sich anmelden": {
    ex: ["Ich melde mich für den Kurs an. — I'm signing up for the course.", "Hast du dich schon angemeldet? — Have you registered yet?"],
    n: "Separable and reflexive. 'sich für/zu etwas anmelden' = to register / sign up.",
  },
  "ausfüllen": {
    ex: ["Füllen Sie bitte das Formular aus. — Please fill out the form.", "Ich habe den Antrag ausgefüllt. — I filled out the application."],
    n: "Separable. Means 'to fill out' (a form).",
  },
  "ausgeben": {
    ex: ["Ich gebe zu viel Geld aus. — I spend too much money.", "Wir haben 50 Euro ausgegeben. — We spent 50 euros."],
    n: "Separable, irregular: e→i (du gibst aus). 'Geld ausgeben für + Akk' = to spend money on.",
  },
  "ausgehen": {
    ex: ["Wir gehen heute Abend aus. — We're going out this evening.", "Plötzlich ist das Licht ausgegangen. — Suddenly the light went out."],
    n: "Separable, irregular; 'sein' in the Perfekt. Means 'to go out' (socially) or 'to go off / run out'.",
  },
  "ausmachen": {
    ex: ["Mach bitte den Fernseher aus. — Please switch off the TV.", "Macht es dir etwas aus, wenn ich rauche? — Do you mind if I smoke?"],
    n: "Separable. Means 'to switch off'; also 'to arrange' or 'to matter' (Macht es dir was aus? = Do you mind?).",
  },
  "auspacken": {
    ex: ["Ich packe die Koffer aus. — I'm unpacking the suitcases.", "Sie hat die Geschenke ausgepackt. — She unwrapped the presents."],
    n: "Separable. Opposite of 'einpacken'. Means 'to unpack / unwrap'.",
  },
  "sich ausruhen": {
    ex: ["Ich ruhe mich kurz aus. — I'll rest for a bit.", "Hast du dich gut ausgeruht? — Did you rest well?"],
    n: "Separable and reflexive. 'sich ausruhen' = to rest / relax.",
  },
  "austragen": {
    ex: ["Der Junge trägt morgens Zeitungen aus. — The boy delivers newspapers in the morning.", "Ich habe die Post ausgetragen. — I delivered the mail."],
    n: "Separable, irregular: a→ä (du trägst aus). Means 'to deliver' (door to door).",
  },
  "einpacken": {
    ex: ["Pack einen Pullover ein! — Pack a sweater!", "Ich habe die Geschenke eingepackt. — I wrapped up the presents."],
    n: "Separable. Opposite of 'auspacken'. Means 'to pack / wrap up'.",
  },
  "sich eintragen": {
    ex: ["Trag dich bitte in die Liste ein. — Please put your name on the list.", "Ich habe mich ins Gästebuch eingetragen. — I signed the guest book."],
    n: "Separable, irregular and reflexive: a→ä (du trägst dich ein). 'sich eintragen' = to sign / register oneself.",
  },
  "einziehen": {
    ex: ["Wir ziehen nächste Woche ein. — We move in next week.", "Sie ist in die neue Wohnung eingezogen. — She moved into the new flat."],
    n: "Separable, irregular (zog ein, eingezogen); 'sein' in the Perfekt. Means 'to move in'; opposite 'ausziehen'.",
  },
  "herstellen": {
    ex: ["Die Firma stellt Möbel her. — The company manufactures furniture.", "Das Produkt wird in Deutschland hergestellt. — The product is made in Germany."],
    n: "Separable. Means 'to manufacture / produce'.",
  },
  "zumachen": {
    ex: ["Mach bitte die Tür zu. — Please close the door.", "Ich habe das Fenster zugemacht. — I closed the window."],
    n: "Separable, colloquial for 'schließen'. Opposite: 'aufmachen'.",
  },
  // separable verbs that the prefix-scan missed (um-/weh-)
  "umziehen": {
    ex: ["Wir ziehen nach München um. — We're moving to Munich.", "Sie ist letzten Monat umgezogen. — She moved house last month."],
    n: "Separable, irregular; 'sein' in the Perfekt when it means 'to move house'. 'sich umziehen' (reflexive) = to change clothes.",
  },
  "umsteigen": {
    ex: ["In Köln müssen wir umsteigen. — We have to change in Cologne.", "Ich bin in Frankfurt umgestiegen. — I changed (trains) in Frankfurt."],
    n: "Separable, irregular; 'sein' in the Perfekt. Means 'to change' (trains/buses); compare 'einsteigen' / 'aussteigen'.",
  },
  "wehtun": {
    ex: ["Mein Kopf tut weh. — My head hurts.", "Hast du dir wehgetan? — Did you hurt yourself?"],
    n: "Separable, irregular (tat weh, wehgetan). 'jemandem wehtun' = to hurt someone (Dativ); 'sich wehtun' = to hurt oneself.",
  },
};

// ── Irregular / mixed verbs (not separable) ────────────────────
const IRREGULAR = {
  "sprechen": {
    ex: ["Sprichst du Deutsch? — Do you speak German?", "Wir haben über das Wetter gesprochen. — We talked about the weather."],
    n: "Irregular: e→i (du sprichst, er spricht). 'sprechen mit jemandem über etwas (Akk)'.",
  },
  "denken": {
    ex: ["Ich denke oft an dich. — I often think of you.", "Was hast du dir dabei gedacht? — What were you thinking?"],
    n: "Mixed verb (dachte, gedacht). 'denken an + Akk' = to think of / about.",
  },
  "beginnen": {
    ex: ["Der Kurs beginnt im September. — The course begins in September.", "Es hat zu schneien begonnen. — It started to snow."],
    n: "Irregular (begann, begonnen). 'beginnen mit + Dativ' or 'beginnen zu + infinitive'.",
  },
  "bleiben": {
    ex: ["Bleib hier! — Stay here!", "Wir sind zu Hause geblieben. — We stayed home."],
    n: "Irregular (blieb, geblieben); takes 'sein' in the Perfekt even though there's no movement.",
  },
  "nennen": {
    ex: ["Wie nennt man das auf Deutsch? — What do you call this in German?", "Sie haben das Kind Anna genannt. — They named the child Anna."],
    n: "Mixed verb (nannte, genannt). 'jemanden/etwas X nennen' = to call / name.",
  },
  "gehen": {
    ex: ["Ich gehe zu Fuß. — I'm going on foot.", "Sie ist nach Hause gegangen. — She went home."],
    n: "Irregular (ging, gegangen); 'sein' in the Perfekt.",
  },
  "laufen": {
    ex: ["Das Kind läuft schnell. — The child runs fast.", "Wir sind durch den Park gelaufen. — We walked/ran through the park."],
    n: "Irregular: a→äu (du läufst); 'sein' in the Perfekt. Means 'to run/walk' or 'to work/run' (machines).",
  },
  "lassen": {
    ex: ["Lass mich in Ruhe! — Leave me alone!", "Ich habe die Schlüssel zu Hause gelassen. — I left the keys at home."],
    n: "Irregular: a→ä (du lässt). Also 'etwas machen lassen' = to have something done.",
  },
  "heißen": {
    ex: ["Wie heißt du? — What's your name?", "Sie hat früher anders geheißen. — She used to have a different name."],
    n: "Irregular (hieß, geheißen). Means 'to be called / named'.",
  },
  "verstehen": {
    ex: ["Ich verstehe das nicht. — I don't understand that.", "Hast du die Frage verstanden? — Did you understand the question?"],
    n: "Irregular (verstand, verstanden). 'ver-' is inseparable, so there's no -ge- in the participle.",
  },
  "fallen": {
    ex: ["Pass auf, der Teller fällt! — Careful, the plate is falling!", "Das Glas ist auf den Boden gefallen. — The glass fell on the floor."],
    n: "Irregular: a→ä (du fällst); 'sein' in the Perfekt (change of position).",
  },
  "mögen": {
    ex: ["Ich mag Schokolade. — I like chocolate.", "Sie hat ihn nie gemocht. — She never liked him."],
    n: "Irregular modal (mochte, gemocht). 'mögen' = to like; 'möchten' is its polite subjunctive (would like).",
  },
  "tun": {
    ex: ["Was kann ich für dich tun? — What can I do for you?", "Das hat weh getan. — That hurt."],
    n: "Irregular (tat, getan). Often colloquial for 'machen'; 'jemandem leidtun/wehtun'.",
  },
  "können": {
    ex: ["Ich kann gut schwimmen. — I can swim well.", "Er hat nicht kommen können. — He wasn't able to come."],
    n: "Irregular modal (ich kann, du kannst; konnte, gekonnt). With another verb the Perfekt uses a double infinitive: 'hat ... können'.",
  },
  "halten": {
    ex: ["Halt das mal kurz! — Hold this for a sec!", "Der Bus hat hier nicht gehalten. — The bus didn't stop here."],
    n: "Irregular: a→ä (du hältst). Means 'to hold' or 'to stop'. 'halten von + Dativ' = to think of.",
  },
  "stehen": {
    ex: ["Ich stehe an der Bushaltestelle. — I'm standing at the bus stop.", "Das Auto hat vor dem Haus gestanden. — The car was parked in front of the house."],
    n: "Irregular (stand, gestanden). In the south of Germany and Austria the Perfekt can take 'sein'.",
  },
  "haben": {
    ex: ["Ich habe einen Bruder. — I have a brother.", "Wir haben viel Spaß gehabt. — We had a lot of fun."],
    n: "Irregular (du hast, er hat; hatte, gehabt). The key auxiliary for the Perfekt of most verbs.",
  },
  "liegen": {
    ex: ["Das Buch liegt auf dem Tisch. — The book is (lying) on the table.", "Ich habe lange im Bett gelegen. — I lay in bed for a long time."],
    n: "Irregular (lag, gelegen). Position verb: 'liegen' (to lie) vs 'legen' (to lay / put).",
  },
  "wissen": {
    ex: ["Ich weiß die Antwort nicht. — I don't know the answer.", "Das habe ich nicht gewusst. — I didn't know that."],
    n: "Irregular (ich weiß, du weißt; wusste, gewusst). 'wissen' = to know a fact; 'kennen' = to be familiar with.",
  },
  "werden": {
    ex: ["Es wird kalt. — It's getting cold.", "Sie ist Ärztin geworden. — She became a doctor."],
    n: "Irregular (du wirst, er wird; wurde, geworden); 'sein' in the Perfekt. Also forms the future and the passive.",
  },
  "lesen": {
    ex: ["Liest du gern? — Do you like reading?", "Ich habe das Buch schon gelesen. — I've already read the book."],
    n: "Irregular: e→ie (du liest, er liest; las, gelesen).",
  },
  "sein": {
    ex: ["Ich bin müde. — I'm tired.", "Wir sind in Berlin gewesen. — We have been to Berlin."],
    n: "Highly irregular (ich bin, du bist, er ist; war, gewesen); its own Perfekt takes 'sein'. The most important verb to learn.",
  },
  "müssen": {
    ex: ["Ich muss jetzt gehen. — I have to go now.", "Sie hat arbeiten müssen. — She had to work."],
    n: "Irregular modal (ich muss, du musst; musste). Double infinitive in the Perfekt: 'hat ... müssen'. 'nicht müssen' = don't have to.",
  },
  "sehen": {
    ex: ["Ich sehe dich morgen. — I'll see you tomorrow.", "Hast du den Film gesehen? — Have you seen the film?"],
    n: "Irregular: e→ie (du siehst, er sieht; sah, gesehen).",
  },
  "wollen": {
    ex: ["Ich will nach Hause. — I want to go home.", "Er hat nicht helfen wollen. — He didn't want to help."],
    n: "Irregular modal (ich will, du willst; wollte). Double infinitive in the Perfekt. Expresses intention.",
  },
  "sollen": {
    ex: ["Du sollst mehr schlafen. — You should sleep more.", "Ich habe das machen sollen. — I was supposed to do that."],
    n: "Modal (sollte, gesollt). Expresses obligation or 'is supposed to'. Double infinitive in the Perfekt.",
  },
  "finden": {
    ex: ["Ich finde meinen Schlüssel nicht. — I can't find my key.", "Wie hast du den Film gefunden? — How did you find / like the film?"],
    n: "Irregular (fand, gefunden). Also 'to think / find': 'Ich finde das gut.'",
  },
  "dürfen": {
    ex: ["Darf ich reinkommen? — May I come in?", "Wir haben nicht bleiben dürfen. — We weren't allowed to stay."],
    n: "Irregular modal (ich darf, du darfst; durfte). Expresses permission. 'nicht dürfen' = must not.",
  },
  "geben": {
    ex: ["Gib mir bitte das Salz. — Please pass me the salt.", "Es hat ein Problem gegeben. — There was a problem."],
    n: "Irregular: e→i (du gibst, er gibt; gab, gegeben). 'es gibt + Akk' = there is / are.",
  },
  "nehmen": {
    ex: ["Ich nehme den Bus. — I'll take the bus.", "Sie hat sich Zeit genommen. — She took her time."],
    n: "Irregular: e→i with a stem change (du nimmst, er nimmt; nahm, genommen).",
  },
  "schreiben": {
    ex: ["Ich schreibe dir eine E-Mail. — I'll write you an email.", "Er hat einen Roman geschrieben. — He wrote a novel."],
    n: "Irregular (schrieb, geschrieben). 'schreiben an + Akk' = to write to.",
  },
  "kommen": {
    ex: ["Ich komme aus Pakistan. — I come from Pakistan.", "Sie ist zu spät gekommen. — She came too late."],
    n: "Irregular (kam, gekommen); 'sein' in the Perfekt.",
  },
  "essen": {
    ex: ["Ich esse kein Fleisch. — I don't eat meat.", "Wir haben schon gegessen. — We've already eaten."],
    n: "Irregular: e→i (du isst, er isst; aß, gegessen). Note the participle 'gegessen'.",
  },
  "erhalten": {
    ex: ["Sie erhält eine Auszeichnung. — She receives an award.", "Ich habe deine Nachricht erhalten. — I received your message."],
    n: "Irregular: a→ä (du erhältst). 'er-' inseparable (no -ge-). A formal alternative to 'bekommen'.",
  },
  "treffen": {
    ex: ["Ich treffe meine Freunde. — I'm meeting my friends.", "Wir haben uns im Café getroffen. — We met at the café."],
    n: "Irregular: e→i (du triffst, er trifft; traf, getroffen). 'sich treffen mit' = to meet up with.",
  },
  "fahren": {
    ex: ["Ich fahre mit dem Rad. — I go by bike.", "Wir sind nach Italien gefahren. — We drove/travelled to Italy."],
    n: "Irregular: a→ä (du fährst). 'sein' when moving somewhere, 'haben' when you drive a vehicle (Ich habe das Auto gefahren).",
  },
  "gewinnen": {
    ex: ["Wer gewinnt das Spiel? — Who's winning the game?", "Unsere Mannschaft hat gewonnen. — Our team won."],
    n: "Irregular (gewann, gewonnen). Opposite of 'verlieren'.",
  },
  "erscheinen": {
    ex: ["Das Buch erscheint im Mai. — The book comes out in May.", "Er ist nicht zur Arbeit erschienen. — He didn't show up for work."],
    n: "Irregular (erschien, erschienen); 'sein' in the Perfekt. 'er-' inseparable. Means 'to appear / be published'.",
  },
  "schwimmen": {
    ex: ["Ich schwimme jeden Tag. — I swim every day.", "Wir sind im See geschwommen. — We swam in the lake."],
    n: "Irregular (schwamm, geschwommen); usually 'sein' in the Perfekt (movement).",
  },
  "sterben": {
    ex: ["Viele alte Bäume sterben. — Many old trees are dying.", "Ihr Großvater ist letztes Jahr gestorben. — Her grandfather died last year."],
    n: "Irregular: e→i (du stirbst, er stirbt); 'sein' in the Perfekt. 'sterben an + Dativ' = to die of.",
  },
  "verlieren": {
    ex: ["Ich verliere oft meinen Schlüssel. — I often lose my key.", "Wir haben das Spiel verloren. — We lost the game."],
    n: "Irregular (verlor, verloren). 'ver-' inseparable. Opposite of 'gewinnen' / 'finden'.",
  },
  "kennen": {
    ex: ["Kennst du diesen Film? — Do you know this film?", "Ich habe ihn gut gekannt. — I knew him well."],
    n: "Mixed verb (kannte, gekannt). 'kennen' = to know / be familiar with (people, places); 'wissen' = to know facts.",
  },
  "helfen": {
    ex: ["Kannst du mir helfen? — Can you help me?", "Sie hat mir sehr geholfen. — She helped me a lot."],
    n: "Irregular: e→i (du hilfst, er hilft; half, geholfen). Takes the Dativ: 'jemandem helfen'.",
  },
  "schlafen": {
    ex: ["Ich schlafe acht Stunden. — I sleep eight hours.", "Hast du gut geschlafen? — Did you sleep well?"],
    n: "Irregular: a→ä (du schläfst, er schläft; schlief, geschlafen).",
  },
  "verlassen": {
    ex: ["Ich verlasse das Haus um acht. — I leave the house at eight.", "Sie hat ihn verlassen. — She left him."],
    n: "Irregular: a→ä (du verlässt). 'ver-' inseparable. 'verlassen' = to leave (a place/person); 'sich verlassen auf + Akk' = to rely on.",
  },
  "vergessen": {
    ex: ["Ich vergesse ständig Namen. — I keep forgetting names.", "Ich habe meinen Schirm vergessen. — I forgot my umbrella."],
    n: "Irregular: e→i (du vergisst, er vergisst). 'ver-' inseparable (no -ge-).",
  },
  "entstehen": {
    ex: ["So entsteht ein Missverständnis. — That's how a misunderstanding arises.", "Dabei ist ein großer Schaden entstanden. — A lot of damage was caused in the process."],
    n: "Irregular (entstand, entstanden); 'sein' in the Perfekt. 'ent-' inseparable. Means 'to arise / come into being'.",
  },
  "bestehen": {
    ex: ["Ich bestehe die Prüfung bestimmt. — I'll definitely pass the exam.", "Sie hat den Test bestanden. — She passed the test."],
    n: "Irregular (bestand, bestanden). 'bestehen' = to pass (an exam); 'bestehen aus' = to consist of; 'bestehen auf + Dativ' = to insist on.",
  },
  "trinken": {
    ex: ["Trinkst du Kaffee? — Do you drink coffee?", "Wir haben ein Bier getrunken. — We had a beer."],
    n: "Irregular (trank, getrunken).",
  },
  "schließen": {
    ex: ["Schließ bitte das Fenster. — Please close the window.", "Das Geschäft hat schon geschlossen. — The shop has already closed."],
    n: "Irregular (schloss, geschlossen). Means 'to close' or 'to conclude'.",
  },
  "tragen": {
    ex: ["Ich trage gern Jeans. — I like wearing jeans.", "Sie hat die schwere Tasche getragen. — She carried the heavy bag."],
    n: "Irregular: a→ä (du trägst, er trägt). Means 'to carry' or 'to wear'.",
  },
  "waschen": {
    ex: ["Ich wasche die Wäsche. — I'm doing the laundry.", "Hast du dir die Hände gewaschen? — Did you wash your hands?"],
    n: "Irregular: a→ä (du wäschst, er wäscht). 'sich waschen' = to wash oneself.",
  },
  "bewerben (sich)": {
    ex: ["Ich bewerbe mich um die Stelle. — I'm applying for the job.", "Sie hat sich bei der Firma beworben. — She applied to the company."],
    n: "Irregular and reflexive: e→i (du bewirbst dich). 'sich bewerben um/für + Akk' or 'bei + Dativ'.",
  },
  "sich bewerben": {
    ex: ["Ich bewerbe mich um den Job. — I'm applying for the job.", "Er hat sich beworben. — He applied."],
    n: "Irregular and reflexive: e→i (du bewirbst dich). 'sich bewerben um/für + Akk' (the post) or 'bei + Dativ' (the company).",
  },
  "bitten": {
    ex: ["Ich bitte dich um Hilfe. — I'm asking you for help.", "Er hat um Ruhe gebeten. — He asked for quiet."],
    n: "Irregular (bat, gebeten). 'bitten um + Akk' = to ask for. Don't confuse with 'bieten' (to offer).",
  },
  "empfehlen": {
    ex: ["Ich empfehle dir dieses Restaurant. — I recommend this restaurant to you.", "Was hast du ihm empfohlen? — What did you recommend to him?"],
    n: "Irregular: e→ie (du empfiehlst, er empfiehlt). 'jemandem etwas empfehlen' (Dativ + Akk).",
  },
  "entscheiden": {
    ex: ["Du musst dich entscheiden. — You have to decide.", "Wir haben uns für das Haus entschieden. — We decided on the house."],
    n: "Irregular (entschied, entschieden). 'sich entscheiden für + Akk' = to decide on. 'ent-' inseparable.",
  },
  "erkennen": {
    ex: ["Ich erkenne dich kaum wieder. — I hardly recognise you.", "Sie hat das Problem sofort erkannt. — She recognised the problem at once."],
    n: "Mixed verb (erkannte, erkannt). 'er-' inseparable. Means 'to recognise'.",
  },
  "verbringen": {
    ex: ["Wir verbringen den Sommer am Meer. — We spend the summer by the sea.", "Ich habe das Wochenende zu Hause verbracht. — I spent the weekend at home."],
    n: "Mixed verb (verbrachte, verbracht). 'Zeit verbringen' = to spend time (use 'ausgeben' only for money).",
  },
  "vergleichen": {
    ex: ["Vergleich mal die Preise. — Compare the prices.", "Ich habe die Angebote verglichen. — I compared the offers."],
    n: "Irregular (verglich, verglichen). 'vergleichen mit + Dativ' = to compare with.",
  },
  "versprechen": {
    ex: ["Ich verspreche es dir. — I promise you.", "Du hast mir das versprochen! — You promised me that!"],
    n: "Irregular: e→i (du versprichst). 'jemandem etwas versprechen'. 'ver-' inseparable.",
  },
  "möchten": {
    ex: ["Ich möchte einen Kaffee, bitte. — I'd like a coffee, please.", "Sie möchte gern nach Hause. — She would like to go home."],
    n: "Polite subjunctive of 'mögen' (= would like). Used like a modal: 'Ich möchte + infinitive'. Very common and polite for requests.",
  },
  "bekommen": {
    ex: ["Ich bekomme oft Post. — I often get mail.", "Sie hat ein Geschenk bekommen. — She got a present."],
    n: "Irregular (bekam, bekommen). 'be-' inseparable, so it takes 'haben'. False friend: 'bekommen' = to receive, NOT 'to become' (= 'werden').",
  },
  "schneiden": {
    ex: ["Ich schneide das Brot. — I'm cutting the bread.", "Ich habe mir in den Finger geschnitten. — I cut my finger."],
    n: "Irregular (schnitt, geschnitten). 'sich schneiden' = to cut oneself.",
  },
  "gefallen": {
    ex: ["Das Bild gefällt mir. — I like the picture.", "Der Film hat ihr gut gefallen. — She liked the film a lot."],
    n: "Irregular: a→ä (es gefällt). Takes the Dativ: 'etwas gefällt mir' = I like it (lit. it pleases me). The participle is just 'gefallen' (no extra ge-).",
  },
  "riechen": {
    ex: ["Es riecht nach Kaffee. — It smells of coffee.", "Hast du das Gas gerochen? — Did you smell the gas?"],
    n: "Irregular (roch, gerochen). 'riechen nach + Dativ' = to smell of.",
  },
  "fliegen": {
    ex: ["Wir fliegen nach Spanien. — We're flying to Spain.", "Sie ist erster Klasse geflogen. — She flew first class."],
    n: "Irregular (flog, geflogen); 'sein' in the Perfekt (movement).",
  },
  "scheinen": {
    ex: ["Die Sonne scheint. — The sun is shining.", "Es scheint, dass er recht hat. — It seems that he's right."],
    n: "Irregular (schien, geschienen). Means 'to shine' or 'to seem' ('Es scheint, dass...').",
  },
  "beraten": {
    ex: ["Die Bank berät dich kostenlos. — The bank advises you free of charge.", "Man hat uns gut beraten. — They gave us good advice."],
    n: "Irregular: a→ä (du berätst). 'be-' inseparable. 'jemanden beraten' = to advise someone.",
  },
  "beschreiben": {
    ex: ["Beschreib mir bitte den Weg. — Please describe the way to me.", "Sie hat das Problem genau beschrieben. — She described the problem precisely."],
    n: "Irregular (beschrieb, beschrieben). 'be-' inseparable. Means 'to describe'.",
  },
  "braten": {
    ex: ["Ich brate die Eier. — I'm frying the eggs.", "Sie hat das Fleisch gebraten. — She roasted the meat."],
    n: "Irregular: a→ä (du brätst). Means 'to fry / roast'.",
  },
  "leihen": {
    ex: ["Kannst du mir 10 Euro leihen? — Can you lend me 10 euros?", "Ich habe mir ein Buch geliehen. — I borrowed a book."],
    n: "Irregular (lieh, geliehen). 'jemandem etwas leihen' = to lend; 'sich (Dativ) etwas leihen' = to borrow.",
  },
  "lügen": {
    ex: ["Du lügst! — You're lying!", "Er hat schon wieder gelogen. — He lied again."],
    n: "Irregular (log, gelogen). 'lügen' = to (tell a) lie; 'jemanden anlügen' = to lie to someone.",
  },
  "raten": {
    ex: ["Rate mal, wen ich getroffen habe! — Guess who I met!", "Sie hat mir geraten, zu warten. — She advised me to wait."],
    n: "Irregular: a→ä (du rätst). Means 'to guess' or 'to advise' ('jemandem raten' + Dativ).",
  },
  "reiten": {
    ex: ["Ich reite gern. — I like riding (horses).", "Wir sind am Strand geritten. — We rode on the beach."],
    n: "Irregular (ritt, geritten); usually 'sein' in the Perfekt (movement).",
  },
  "rufen": {
    ex: ["Ruf laut, wenn du Hilfe brauchst. — Shout if you need help.", "Jemand hat um Hilfe gerufen. — Someone called for help."],
    n: "Irregular (rief, gerufen). 'rufen' = to call / shout; 'anrufen' = to phone.",
  },
  "singen": {
    ex: ["Sie singt im Chor. — She sings in a choir.", "Wir haben zusammen gesungen. — We sang together."],
    n: "Irregular (sang, gesungen).",
  },
  "überweisen": {
    ex: ["Ich überweise dir das Geld. — I'll transfer you the money.", "Die Miete habe ich schon überwiesen. — I've already transferred the rent."],
    n: "Irregular (überwies, überwiesen). Here 'über-' is inseparable (no -ge-). Means 'to transfer (money)' or 'to refer (a patient)'.",
  },
  "sich unterhalten": {
    ex: ["Wir unterhalten uns über Politik. — We're talking about politics.", "Ich habe mich nett mit ihr unterhalten. — I had a nice chat with her."],
    n: "Irregular and reflexive: a→ä (du unterhältst dich). Here 'unter-' is inseparable. 'sich unterhalten über + Akk' = to chat / converse.",
  },
  "unternehmen": {
    ex: ["Was unternehmen wir heute? — What shall we do today?", "Wir haben einen Ausflug unternommen. — We went on an outing."],
    n: "Irregular: e→i (du unternimmst). 'unter-' inseparable here. 'etwas unternehmen' = to do / undertake something.",
  },
  "unterschreiben": {
    ex: ["Unterschreiben Sie bitte hier. — Please sign here.", "Ich habe den Vertrag unterschrieben. — I signed the contract."],
    n: "Irregular (unterschrieb, unterschrieben). 'unter-' inseparable. Means 'to sign'.",
  },
  "verschieben": {
    ex: ["Wir verschieben das Treffen auf morgen. — We're postponing the meeting to tomorrow.", "Der Termin wurde verschoben. — The appointment was postponed."],
    n: "Irregular (verschob, verschoben). 'ver-' inseparable. Means 'to postpone' or 'to move / shift'.",
  },
};

// ── Merge ──────────────────────────────────────────────────────
const KEY_ORDER = ["w", "e", "ex", "t", "p2", "hs", "pr", "pt", "pk", "n", "sep", "lvl"];
const verbs = JSON.parse(readFileSync(FILE, "utf8"));

let sepCount = 0, irrCount = 0;
const unmatched = { sep: [], irr: [] };

const out = verbs.map((v) => {
  let entry = null, isSep = false;
  if (SEPARABLE[v.w]) { entry = SEPARABLE[v.w]; isSep = true; sepCount++; }
  else if (IRREGULAR[v.w]) { entry = IRREGULAR[v.w]; irrCount++; }
  if (!entry) return v;

  const merged = { ...v, ex: entry.ex, n: entry.n };
  if (isSep) merged.sep = true;

  // reorder keys for readable diffs
  const ordered = {};
  for (const k of KEY_ORDER) if (k in merged) ordered[k] = merged[k];
  for (const k of Object.keys(merged)) if (!(k in ordered)) ordered[k] = merged[k];
  return ordered;
});

// report any map keys that didn't match a verb (typos)
const words = new Set(verbs.map((v) => v.w));
for (const k of Object.keys(SEPARABLE)) if (!words.has(k)) unmatched.sep.push(k);
for (const k of Object.keys(IRREGULAR)) if (!words.has(k)) unmatched.irr.push(k);

writeFileSync(FILE, JSON.stringify(out, null, 2) + "\n");
console.log(`Updated ${sepCount} separable + ${irrCount} irregular verbs.`);
if (unmatched.sep.length || unmatched.irr.length) {
  console.log("WARNING — map keys with no matching verb:", JSON.stringify(unmatched));
}
