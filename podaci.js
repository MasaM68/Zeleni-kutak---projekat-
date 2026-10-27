/* =========================================================
   Zeleni Kutak – pomoćni (simulirani) podaci prototipa
   Biljke dolaze sa API-ja https://plants.pequla.com,
   a ovde su podaci koje API nema: recenzije, demo korisnik,
   šifarnici i stablo dijaloga virtuelnog asistenta.
   ========================================================= */

const API_ADRESA = "https://plants.pequla.com/api";

const IKONICE_KATEGORIJA = {
    "Sobne biljke": "🪴",
    "Sukulenti i kaktusi": "🌵",
    "Začinsko i aromatično bilje": "🌿",
    "Baštensko cveće": "🌷",
    "Voće": "🍓",
    "Povrće": "🍅",
    "Drveće i žbunje": "🌳"
};

const CILJNE_GRUPE = [
    { naziv: "Početnici", opis: "Otporne biljke koje praštaju greške u nezi" },
    { naziv: "Hobisti", opis: "Za one koji uživaju u redovnoj brizi o biljkama" },
    { naziv: "Porodice", opis: "Biljke za dom, decu i zajedničko baštovanstvo" },
    { naziv: "Ljubitelji dekorativnih biljaka", opis: "Upečatljive biljke za uređenje prostora" },
    { naziv: "Iskusni uzgajivači", opis: "Zahtevnije vrste za iskusne ruke" }
];

const STATUSI = {
    rezervisano: { naziv: "Rezervisano", ikonica: "🕓", opis: "Biljka je rezervisana i priprema se. Rezervaciju možete menjati ili otkazati." },
    pristiglo: { naziv: "Pristiglo", ikonica: "📦", opis: "Biljka je stigla. Možete je oceniti i ukloniti iz korpe." },
    otkazano: { naziv: "Otkazano", ikonica: "✖", opis: "Rezervacija je otkazana i ne ulazi u ukupnu cenu." }
};

const OPISI_OCENA = ["", "Loše", "Slabo", "Dobro", "Vrlo dobro", "Odlično"];

const RADNJA_ADRESA = "Zmaj Jovina 12, Novi Sad";

// Polja koja čine "tip" biljke – koriste se u pretrazi po tipu i na stranici biljke
const POLJA_TIPA = [
    { kljuc: "category", naziv: "Vrsta (kategorija)" },
    { kljuc: "plant_type", naziv: "Oblik prodaje" },
    { kljuc: "climate", naziv: "Podneblje" },
    { kljuc: "season", naziv: "Sezona" },
    { kljuc: "intended_use", naziv: "Namena" },
    { kljuc: "light_requirement", naziv: "Svetlost" },
    { kljuc: "watering", naziv: "Zalivanje" }
];

/* ---------- Simulirane recenzije ----------
   API ne sadrži recenzije, pa se za svaku biljku generiše stalan
   (uvek isti) skup recenzija na osnovu njenog ID-ja. */

const IMENA_RECENZENATA = [
    "Milica P.", "Stefan J.", "Ana K.", "Marko S.", "Jovana R.", "Nikola D.",
    "Teodora M.", "Luka V.", "Ivana B.", "Petar T.", "Sara Đ.", "Vuk N.",
    "Katarina L.", "Filip G.", "Mina Z.", "Dušan C."
];

const TEKSTOVI_RECENZIJA = {
    5: [
        "Biljka je stigla u savršenom stanju, odlično upakovana. Sve preporuke!",
        "Prelepa i zdrava, već posle nedelju dana pušta nove listove.",
        "Tačno kao u opisu. Uputstvo za negu je jasno i korisno.",
        "Treći put rezervišem kod vas i opet sam oduševljen/a kvalitetom.",
        "Preuzimanje u radnji je bilo brzo, a osoblje mi je dalo dodatne savete.",
        "Odlična sadnica, primila se bez ikakvih problema."
    ],
    4: [
        "Lepa biljka, malo manja nego što sam očekivao/la, ali brzo raste.",
        "Dobar kvalitet, samo je dostava kasnila jedan dan.",
        "Zdrava biljka, saksija je mogla biti malo veća.",
        "Vrlo zadovoljan/na, cena je korektna za ovaj kvalitet.",
        "Sve u redu, jedan list je bio malo oštećen u transportu."
    ],
    3: [
        "Biljka je u redu, ali je nekoliko listova stiglo požutelo.",
        "Solidno za tu cenu, ništa posebno.",
        "Trebalo joj je dosta vremena da se oporavi posle presađivanja."
    ],
    2: [
        "Stigla je prilično uvela, oporavlja se sporo.",
        "Očekivao/la sam veću i razvijeniju sadnicu."
    ]
};

function generator(seme) {
    // Jednostavan generator pseudo-slučajnih brojeva (uvek isti niz za isto seme)
    let a = seme * 2654435761 % 4294967296;
    return function () {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function generisiRecenzije(biljka) {
    const slucajno = generator(biljka.id);
    const brojRecenzija = slucajno() < 0.12 ? 0 : 1 + Math.floor(slucajno() * 5);
    const recenzije = [];
    const pocetak = new Date(biljka.production_date + "T12:00:00");
    pocetak.setDate(pocetak.getDate() + 20);
    const kraj = new Date("2026-10-20T12:00:00");
    const raspon = Math.max(1, (kraj - pocetak) / 86400000);

    for (let i = 0; i < brojRecenzija; i++) {
        const r = slucajno();
        const ocena = r < 0.45 ? 5 : r < 0.8 ? 4 : r < 0.93 ? 3 : 2;
        const tekstovi = TEKSTOVI_RECENZIJA[ocena];
        const datum = new Date(pocetak);
        datum.setDate(datum.getDate() + Math.floor(slucajno() * raspon));
        recenzije.push({
            id: "g" + biljka.id + "-" + i,
            biljkaId: biljka.id,
            autor: IMENA_RECENZENATA[Math.floor(slucajno() * IMENA_RECENZENATA.length)],
            ocena: ocena,
            tekst: tekstovi[Math.floor(slucajno() * tekstovi.length)],
            datum: datum.toISOString().slice(0, 10)
        });
    }
    return recenzije;
}

/* ---------- Demo korisnik (za brzu proveru prototipa) ---------- */

const DEMO_KORISNIK = {
    korisnickoIme: "jelena",
    lozinka: "biljke123",
    ime: "Jelena",
    prezime: "Marković",
    email: "jelena.markovic@gmail.com",
    telefon: "064 123 4567",
    adresa: "Bulevar oslobođenja 45",
    grad: "Novi Sad",
    postanskiBroj: "21000",
    omiljeneVrste: ["Sobne biljke", "Začinsko i aromatično bilje"],
    clanOd: "2026-03-14"
};

// Početni sadržaj korpe demo korisnika – po jedna biljka u svakom statusu
const DEMO_KORPA = [
    { naziv: "Monstera deliciosa", kolicina: 1, preuzimanje: "dostava", datumPreuzimanja: "2026-11-03", napomena: "Molim vas da me pozovete pola sata pre dostave.", status: "rezervisano", datumRezervacije: "2026-10-24" },
    { naziv: "Bosiljak", kolicina: 3, preuzimanje: "radnja", datumPreuzimanja: "2026-10-30", napomena: "", status: "rezervisano", datumRezervacije: "2026-10-25" },
    { naziv: "Aloe vera", kolicina: 1, preuzimanje: "radnja", datumPreuzimanja: "2026-10-18", napomena: "", status: "pristiglo", datumRezervacije: "2026-10-12" },
    { naziv: "Lavanda", kolicina: 2, preuzimanje: "dostava", datumPreuzimanja: "2026-10-10", napomena: "", status: "pristiglo", datumRezervacije: "2026-10-03", ocena: 5, recenzija: "Miriše predivno, obe sadnice su se odlično primile na terasi." },
    { naziv: "Lala", kolicina: 10, preuzimanje: "radnja", datumPreuzimanja: "2026-10-22", napomena: "Za poklon.", status: "otkazano", datumRezervacije: "2026-10-15" }
];

/* ---------- Virtuelni asistent "Zelenko" – unapred definisano stablo dijaloga ----------
   Svaki čvor ima poruku, opcije (tekst + sledeći čvor ili ruta)
   i opciono preporuku biljaka (funkcija koja bira biljke). */

const DIJALOG = {
    start: {
        poruka: () => "Zdravo" + (korisnik ? ", " + korisnik.ime : "") + "! Ja sam Zelenko 🌱, virtuelni asistent Zelenog Kutka. Kako mogu da Vam pomognem?",
        opcije: [
            ["🪴 Pomozite mi da izaberem biljku", "izbor"],
            ["📝 Kako funkcioniše rezervacija?", "rezervacija"],
            ["🏷️ Šta znače statusi u korpi?", "statusi"],
            ["💧 Saveti za negu biljaka", "nega"],
            ["🚚 Preuzimanje i dostava", "dostava"],
            ["👤 Nalog i profil", "nalog"]
        ]
    },
    izbor: {
        poruka: "Rado! Gde će biljka živeti?",
        opcije: [
            ["🏠 U stanu ili kancelariji", "izbor_unutra"],
            ["🌤️ U bašti, dvorištu ili na terasi", "izbor_napolju"],
            ["🥕 Želim nešto jestivo", "izbor_jestivo"]
        ]
    },
    izbor_unutra: {
        poruka: "Koliko svetla ima taj prostor?",
        opcije: [
            ["☀️ Puno direktnog sunca", "prep_sunce"],
            ["⛅ Polusenka, indirektno svetlo", "prep_senka"]
        ]
    },
    prep_sunce: {
        poruka: "Za sunčane prozore preporučujem sukulente i kaktuse – zalivaju se retko i lako se održavaju:",
        preporuka: b => b.category === "Sukulenti i kaktusi",
        opcije: [["🔎 Prikaži sve sukulente", "#/biljke?kategorija=Sukulenti i kaktusi"], ["⛅ A za polusenku?", "prep_senka"]]
    },
    prep_senka: {
        poruka: "Ove sobne biljke vole polusenku, a označene su kao pogodne za početnike:",
        preporuka: b => b.category === "Sobne biljke" && b.light_requirement === "Polusenka" && b.target_audience === "Početnici",
        opcije: [["🔎 Prikaži sve sobne biljke", "#/biljke?kategorija=Sobne biljke"]]
    },
    izbor_napolju: {
        poruka: "Šta Vam je najvažnije u bašti?",
        opcije: [
            ["🌷 Cveće i boje", "prep_cvece"],
            ["🌳 Zelenilo, živica, drveće", "prep_drvece"],
            ["🌿 Mirisno začinsko bilje", "prep_zacini"]
        ]
    },
    prep_cvece: {
        poruka: "Evo najbolje ocenjenog baštenskog cveća:",
        preporuka: b => b.category === "Baštensko cveće",
        opcije: [["🔎 Prikaži svo baštensko cveće", "#/biljke?kategorija=Baštensko cveće"]]
    },
    prep_drvece: {
        poruka: "Za živice i dugovečno zelenilo izdvajam:",
        preporuka: b => b.category === "Drveće i žbunje",
        opcije: [["🔎 Prikaži drveće i žbunje", "#/biljke?kategorija=Drveće i žbunje"]]
    },
    prep_zacini: {
        poruka: "Začinsko bilje lepo uspeva i na terasi, u saksiji. Najbolje ocenjeno:",
        preporuka: b => b.category === "Začinsko i aromatično bilje",
        opcije: [["🔎 Prikaži sve začine", "#/biljke?kategorija=Začinsko i aromatično bilje"]]
    },
    izbor_jestivo: {
        poruka: "Odlično! Voće ili povrće?",
        opcije: [["🍓 Voće", "prep_voce"], ["🍅 Povrće", "prep_povrce"]]
    },
    prep_voce: {
        poruka: "Voćne sadnice koje kupci najviše hvale:",
        preporuka: b => b.category === "Voće",
        opcije: [["🔎 Prikaži sve voće", "#/biljke?kategorija=Voće"]]
    },
    prep_povrce: {
        poruka: "Povrće koje je lako uzgojiti i u kućnoj bašti:",
        preporuka: b => b.category === "Povrće",
        opcije: [["🔎 Prikaži sve povrće", "#/biljke?kategorija=Povrće"]]
    },
    rezervacija: {
        poruka: "Rezervacija ide u tri koraka:<br><b>1.</b> Pronađite biljku pretragom ili u katalogu.<br><b>2.</b> Kliknite <b>Rezerviši</b> i izaberite količinu, način i datum preuzimanja.<br><b>3.</b> Potvrdite – biljka se odmah dodaje u Vašu <b>korpu rezervacija</b> sa statusom „Rezervisano”.<br>Za rezervaciju je potrebno da budete prijavljeni.",
        opcije: [
            ["💳 Da li se plaća unapred?", "placanje"],
            ["✏️ Mogu li da izmenim rezervaciju?", "izmena"],
            ["🔎 Otvori katalog", "#/biljke"]
        ]
    },
    placanje: {
        poruka: "Ne – rezervacija je besplatna, a plaćanje je pri preuzimanju (gotovinom ili karticom). U korpi uvek vidite ukupnu cenu svih rezervisanih i pristiglih biljaka.",
        opcije: [["🛒 Otvori korpu", "#/korpa"]]
    },
    izmena: {
        poruka: "Može, dok je biljka u statusu <b>🕓 Rezervisano</b>: u korpi kliknite <b>Izmeni</b> i promenite količinu, način ili datum preuzimanja i napomenu. Tu možete i otkazati rezervaciju.",
        opcije: [["🏷️ Šta znače ostali statusi?", "statusi"]]
    },
    statusi: {
        poruka: "Svaka biljka u korpi ima status:<br><b>🕓 Rezervisano</b> – biljka se priprema; rezervaciju možete menjati ili otkazati.<br><b>📦 Pristiglo</b> – biljka je stigla; možete je oceniti i ukloniti iz korpe.<br><b>✖ Otkazano</b> – rezervacija je otkazana i ne ulazi u ukupnu cenu.",
        opcije: [["⭐ Kako da ocenim biljku?", "ocena"], ["✏️ Kako da izmenim rezervaciju?", "izmena"]]
    },
    ocena: {
        poruka: "Ocenjivati možete samo biljke koje ste rezervisali i koje imaju status <b>📦 Pristiglo</b>. U korpi kliknite <b>Oceni biljku</b>, izaberite od 1 do 5 zvezdica i, ako želite, napišite recenziju. Ona će se pojaviti na stranici biljke.",
        opcije: [["🛒 Otvori korpu", "#/korpa"]]
    },
    nega: {
        poruka: "Rado ću pomoći. Šta Vas zanima?",
        opcije: [
            ["💧 Koliko često da zalivam?", "nega_zalivanje"],
            ["🍂 Listovi mi žute", "nega_zuto"],
            ["🪴 Kada da presadim biljku?", "nega_presadjivanje"],
            ["🐈 Biljke i kućni ljubimci", "nega_ljubimci"]
        ]
    },
    nega_zalivanje: {
        poruka: "Pravilo palca: zabodite prst 2–3 cm u zemlju – ako je suva, zalijte. Sukulenti se zalivaju tek kad se supstrat potpuno osuši, a tropske sobne biljke kada se prosuši površinski sloj. Na stranici svake biljke piše preporuka (retko / umereno / redovno).",
        opcije: [["🍂 Listovi mi žute", "nega_zuto"]]
    },
    nega_zuto: {
        poruka: "Najčešći uzrok je <b>previše vode</b>: ako su donji listovi žuti, a zemlja stalno vlažna, proredite zalivanje i proverite drenažu. Ako su vrhovi listova suvi i smeđi – biljka je verovatno na prejakom suncu ili je vazduh previše suv.",
        opcije: [["💧 Koliko često da zalivam?", "nega_zalivanje"]]
    },
    nega_presadjivanje: {
        poruka: "Najbolje u proleće, kada koren počne da izlazi kroz drenažne otvore. Uzmite saksiju 2–4 cm širu, svež supstrat i posle presađivanja umereno zalijte. Prvih nedelju dana držite biljku dalje od jakog sunca.",
        opcije: [["💧 Saveti za zalivanje", "nega_zalivanje"]]
    },
    nega_ljubimci: {
        poruka: "Ako imate mačku ili psa, izbegavajte difenbahiju, oleander i aloe veru jer su otrovni za ljubimce. Bezbednijim se smatraju ove biljke:",
        preporuka: b => ["Kalathea orbifolija", "Maranta", "Hlorofitum", "Pilea", "Peperomija"].includes(b.name),
        opcije: [["🪴 Pomozite mi da izaberem biljku", "izbor"]]
    },
    dostava: {
        poruka: "Pri rezervaciji birate:<br><b>🏪 Lično preuzimanje</b> u radnji (" + RADNJA_ADRESA + ", radnim danima 9–19h, subotom 9–15h) ili<br><b>🚚 Dostavu</b> na adresu iz Vašeg profila.<br>Datum preuzimanja može biti najranije za 2, a najkasnije za 30 dana, i možete ga menjati dok je status „Rezervisano”.",
        opcije: [["☎️ Kontakt sa osobljem", "osoblje"]]
    },
    osoblje: {
        poruka: "Naše osoblje je dostupno radnim danima od 9 do 17h na telefon <b>021 123 456</b> ili email <b>podrska@zelenikutak.rs</b>. Odgovaramo u roku od jednog radnog dana.",
        opcije: []
    },
    nalog: {
        poruka: () => korisnik
            ? "Prijavljeni ste kao <b>" + esc(korisnik.ime + " " + korisnik.prezime) + "</b>. Na stranici profila možete menjati lične i kontakt podatke, omiljene vrste biljaka i lozinku."
            : "Pregled biljaka i čitanje recenzija dostupni su svima. Za rezervacije i pristup korpi potrebno je da se prijavite, ili da napravite nalog ako ga nemate.",
        opcije: () => korisnik
            ? [["👤 Otvori profil", "#/profil"], ["🛒 Otvori korpu", "#/korpa"]]
            : [["🔑 Prijava", "#/prijava"], ["✨ Registracija", "#/registracija"]]
    }
};
