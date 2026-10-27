/* =========================================================
   Zeleni Kutak – prototip korisničkog interfejsa
   digitalne prodavnice biljaka
   Autor: Maša Milosavljević

   - Biljke se učitavaju sa API-ja https://plants.pequla.com/api/plants
     (ako API nije dostupan, koristi se lokalna kopija podataka).
   - Korisnici, korpe rezervacija i recenzije se simuliraju lokalno
     (localStorage), bez pozadinske logike i baze podataka.
   ========================================================= */

// ---------- Stanje aplikacije ----------

let biljke = [];
let izvorPodataka = "kopija";
let korisnik = null;
const generisaneRecenzije = {};

const stanje = {
    kriterijum: "naziv",     // izabrani kriterijum pretrage (tab)
    pretraga: null,          // primenjena pretraga: { kriterijum, vrednosti, opis }
    kategorija: "",          // ručni pregled po kategoriji
    sortiranje: "preporuka",
    prikazano: 24,
    filterKorpe: "sve",
    izmenaProfila: false,
    poslePrijave: null,      // { ruta, rezervisi } – kuda posle prijave
    porukaPrijave: ""
};

const aplikacija = document.getElementById("aplikacija");

const KRITERIJUMI = [
    { kljuc: "naziv", naslov: "Naziv", ikonica: "🔤" },
    { kljuc: "opis", naslov: "Opis, sadnja i nega", ikonica: "📖" },
    { kljuc: "tip", naslov: "Tip", ikonica: "🏷️" },
    { kljuc: "ciljna", naslov: "Ciljna grupa", ikonica: "👥" },
    { kljuc: "datum", naslov: "Datum proizvodnje", ikonica: "📅" },
    { kljuc: "cena", naslov: "Cena", ikonica: "💰" },
    { kljuc: "recenzije", naslov: "Recenzije", ikonica: "⭐" }
];

const SORTIRANJA = {
    preporuka: "Preporučeno",
    cenaRastuce: "Cena: od najniže",
    cenaOpadajuce: "Cena: od najviše",
    ocena: "Najbolje ocenjene",
    najnovije: "Najnovija proizvodnja",
    naziv: "Naziv: A – Ž"
};

// ---------- Lokalno skladište (localStorage, uz rezervu u memoriji) ----------

const memorija = {};

function ucitaj(kljuc, podrazumevano) {
    try {
        const tekst = localStorage.getItem(kljuc);
        if (tekst !== null) return JSON.parse(tekst);
    } catch (e) { /* skladište nije dostupno */ }
    return kljuc in memorija ? memorija[kljuc] : podrazumevano;
}

function sacuvaj(kljuc, vrednost) {
    memorija[kljuc] = vrednost;
    try { localStorage.setItem(kljuc, JSON.stringify(vrednost)); } catch (e) { /* radi i bez skladišta */ }
}

function sviKorisnici() { return ucitaj("zk_korisnici", []); }

function korpa() {
    if (!korisnik) return [];
    return ucitaj("zk_korpe", {})[korisnik.korisnickoIme] || [];
}

function sacuvajKorpu(stavke) {
    const sve = ucitaj("zk_korpe", {});
    sve[korisnik.korisnickoIme] = stavke;
    sacuvaj("zk_korpe", sve);
    osveziZnackuKorpe();
}

function korisnickeRecenzije() { return ucitaj("zk_recenzije", []); }

function pripremiDemoPodatke(prinudno) {
    if (!prinudno && ucitaj("zk_verzija", 0) === 1) return;

    const stavke = [];
    const recenzije = [];
    DEMO_KORPA.forEach((s, i) => {
        const biljka = biljke.find(b => b.name === s.naziv);
        if (!biljka) return;
        const stavka = {
            id: "demo" + i,
            biljkaId: biljka.id,
            kolicina: s.kolicina,
            cenaPoKomadu: biljka.price,
            preuzimanje: s.preuzimanje,
            datumPreuzimanja: s.datumPreuzimanja,
            napomena: s.napomena,
            status: s.status,
            datumRezervacije: s.datumRezervacije,
            ocena: s.ocena || null
        };
        stavke.push(stavka);
        if (s.ocena) {
            recenzije.push({
                id: "k-" + stavka.id, stavkaId: stavka.id, biljkaId: biljka.id,
                autor: "Jelena M.", korisnik: DEMO_KORISNIK.korisnickoIme,
                ocena: s.ocena, tekst: s.recenzija, datum: "2026-10-14"
            });
        }
    });

    sacuvaj("zk_korisnici", [DEMO_KORISNIK]);
    sacuvaj("zk_korpe", { [DEMO_KORISNIK.korisnickoIme]: stavke });
    sacuvaj("zk_recenzije", recenzije);
    sacuvaj("zk_sesija", null);
    sacuvaj("zk_verzija", 1);
}

// ---------- Pomoćne funkcije ----------

function esc(tekst) {
    return String(tekst ?? "").replace(/[&<>"']/g, z => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]));
}

function cena(iznos) {
    return String(Math.round(iznos)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " RSD";
}

function datum(iso) {
    if (!iso) return "—";
    const [g, m, d] = iso.slice(0, 10).split("-");
    return d + "." + m + "." + g + ".";
}

function isoDatum(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function danas(pomakDana = 0) {
    const d = new Date();
    d.setDate(d.getDate() + pomakDana);
    return isoDatum(d);
}

// Pretraga ne razlikuje velika/mala slova ni kvačice (š → s, č → c…)
function normalizuj(tekst) {
    return String(tekst).toLocaleLowerCase("sr").replace(/đ/g, "dj").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function sadrzi(tekst, upit) {
    const t = normalizuj(tekst);
    return normalizuj(upit).split(/\s+/).filter(Boolean).every(rec => t.includes(rec));
}

function biljkaPoId(id) { return biljke.find(b => b.id === Number(id)); }

function inicijali(ime, prezime) { return ((ime || "?").charAt(0) + (prezime || "").charAt(0)).toUpperCase(); }

// Srpska množina: 1 biljka, 2–4 biljke, 5+ biljaka (11–14 → biljaka)
function mnozina(n, jedan, dva, pet) {
    const d = n % 10, s = n % 100;
    if (d === 1 && s !== 11) return n + " " + jedan;
    if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return n + " " + dva;
    return n + " " + pet;
}

function recenzijeBiljke(id) {
    return (generisaneRecenzije[id] || [])
        .concat(korisnickeRecenzije().filter(r => r.biljkaId === id))
        .sort((a, b) => b.datum.localeCompare(a.datum));
}

function prosekOcena(id) {
    const r = recenzijeBiljke(id);
    return r.length ? r.reduce((s, x) => s + x.ocena, 0) / r.length : 0;
}

function zvezdice(ocena, klasa = "") {
    let html = `<span class="zvezdice ${klasa}" role="img" aria-label="Ocena ${ocena.toFixed(1).replace(".", ",")} od 5">`;
    for (let i = 1; i <= 5; i++) {
        const vrsta = ocena >= i - 0.25 ? "puna" : ocena >= i - 0.75 ? "pola" : "";
        html += `<span class="zvezda ${vrsta}" aria-hidden="true">★</span>`;
    }
    return html + "</span>";
}

function ocenaKratko(id) {
    const r = recenzijeBiljke(id);
    if (!r.length) return `<span class="bez-ocene">Još nema recenzija</span>`;
    const p = prosekOcena(id);
    return `${zvezdice(p)} <strong>${p.toFixed(1).replace(".", ",")}</strong> <span class="tiho">(${r.length})</span>`;
}

function brojRecenzijaTekst(n) {
    return mnozina(n, "recenzija", "recenzije", "recenzija");
}

function vrednostiPolja(kljuc) {
    return [...new Set(biljke.map(b => b[kljuc]))].sort((a, b) => a.localeCompare(b, "sr"));
}

function kategorije() {
    return vrednostiPolja("category").map(naziv => ({ naziv, broj: biljke.filter(b => b.category === naziv).length }));
}

function idi(ruta) {
    if (location.hash === ruta) ruter();
    else location.hash = ruta;
}

// ---------- Učitavanje podataka ----------

async function ucitajBiljke() {
    if (!window.ZK_BEZ_MREZE) {
        try {
            const kontroler = new AbortController();
            const tajmer = setTimeout(() => kontroler.abort(), 5000);
            const odgovor = await fetch(API_ADRESA + "/plants", { signal: kontroler.signal });
            clearTimeout(tajmer);
            if (!odgovor.ok) throw new Error("HTTP " + odgovor.status);
            const podaci = await odgovor.json();
            if (Array.isArray(podaci) && podaci.length) {
                izvorPodataka = "api";
                return podaci;
            }
        } catch (greska) {
            console.warn("API nije dostupan, koristi se lokalna kopija.", greska);
        }
    }
    izvorPodataka = "kopija";
    return window.BILJKE_KOPIJA || [];
}

function pripremiBiljku(b) {
    // Slike se uvek prikazuju iz lokalnog foldera images/ (rade i bez interneta)
    return Object.assign({}, b, { slika: "images/" + String(b.image_url).split("/").pop() });
}

// ---------- Ruter (navigacija između stranica) ----------

function ruter() {
    const [putanja, upit] = location.hash.replace(/^#\/?/, "").split("?");
    const [ruta, param] = putanja.split("/");
    const parametri = new URLSearchParams(upit || "");

    zatvoriModal();

    switch (ruta) {
        case "":
            prikaziPocetnu();
            break;
        case "biljke":
            if (parametri.has("kategorija")) {
                stanje.kategorija = parametri.get("kategorija");
                stanje.pretraga = null;
                stanje.prikazano = 24;
                history.replaceState(null, "", "#/biljke");
            }
            prikaziKatalog();
            break;
        case "biljka":
            prikaziDetalje(Number(param));
            break;
        case "korpa":
            if (zahtevajPrijavu("#/korpa", "Za pristup korpi rezervacija potrebno je da se prijavite.")) prikaziKorpu();
            break;
        case "profil":
            if (zahtevajPrijavu("#/profil", "Za pregled profila potrebno je da se prijavite.")) prikaziProfil();
            break;
        case "prijava":
            if (korisnik) { location.replace("#/profil"); return; }
            prikaziPrijavu();
            break;
        case "registracija":
            if (korisnik) { location.replace("#/profil"); return; }
            prikaziRegistraciju();
            break;
        default:
            prikaziNijePronadjeno();
    }

    document.querySelectorAll(".glavna-nav a, .korisnik-zona a").forEach(a => {
        a.classList.toggle("aktivno", a.dataset.ruta === ruta);
    });
    window.scrollTo(0, 0);

    // Ako je gost hteo da rezerviše pa se prijavio – odmah otvori formu za rezervaciju
    if (stanje.posleRezervisi && korisnik && ruta === "biljka") {
        const id = stanje.posleRezervisi;
        stanje.posleRezervisi = null;
        otvoriFormuRezervacije(biljkaPoId(id));
    }
}

function zahtevajPrijavu(ruta, poruka) {
    if (korisnik) return true;
    stanje.poslePrijave = ruta;
    stanje.porukaPrijave = poruka;
    location.replace("#/prijava");
    return false;
}

// ---------- Zaglavlje ----------

function osveziZaglavlje() {
    const zona = document.getElementById("korisnikZona");
    if (korisnik) {
        zona.innerHTML = `
            <a class="korisnik-link" href="#/profil" data-ruta="profil" title="Moj profil">
                <span class="avatar">${esc(inicijali(korisnik.ime, korisnik.prezime))}</span>
                <span>${esc(korisnik.ime)}</span>
            </a>
            <button class="dugme-tekst" data-akcija="odjava">Odjavi se</button>`;
    } else {
        zona.innerHTML = `
            <a class="dugme dugme-obrub dugme-malo" href="#/prijava" data-ruta="prijava">Prijavi se</a>
            <a class="dugme dugme-malo" href="#/registracija" data-ruta="registracija">Registruj se</a>`;
    }
    osveziZnackuKorpe();
}

function osveziZnackuKorpe() {
    const znacka = document.getElementById("brojUKorpi");
    const broj = korpa().filter(s => s.status !== "otkazano").length;
    znacka.textContent = broj;
    znacka.hidden = !korisnik;
}

function animirajKorpu() {
    const znacka = document.getElementById("brojUKorpi");
    znacka.classList.remove("skok");
    void znacka.offsetWidth;
    znacka.classList.add("skok");
}

// ---------- Kartica biljke ----------

function kartica(b, pogodak = "") {
    return `
    <article class="kartica-biljke">
        <a class="kartica-slika" href="#/biljka/${b.id}" tabindex="-1" aria-hidden="true">
            <img src="${b.slika}" alt="" loading="lazy">
            <span class="oznaka-oblik">${esc(b.plant_type)}</span>
        </a>
        <div class="kartica-telo">
            <p class="kartica-kategorija">${IKONICE_KATEGORIJA[b.category] || "🌱"} ${esc(b.category)}</p>
            <h3><a href="#/biljka/${b.id}">${esc(b.name)}</a></h3>
            ${b.latin_name !== b.name ? `<p class="latinski">${esc(b.latin_name)}</p>` : `<p class="latinski">&nbsp;</p>`}
            <div class="kartica-ocena">${ocenaKratko(b.id)}</div>
            <p class="kartica-grupa" title="Ciljna grupa">👥 ${esc(b.target_audience)}</p>
            ${pogodak ? `<p class="pogodak">🔎 ${pogodak}</p>` : ""}
            <div class="kartica-dno">
                <strong class="cena">${cena(b.price)}</strong>
                <button class="dugme dugme-malo" data-akcija="rezervisi" data-id="${b.id}" aria-label="Rezerviši ${esc(b.name)}">Rezerviši</button>
            </div>
        </div>
    </article>`;
}

// ---------- Početna stranica ----------

function prikaziPocetnu() {
    document.title = "Zeleni Kutak – digitalna prodavnica biljaka";
    const ocenjene = biljke.filter(b => recenzijeBiljke(b.id).length >= 3);
    const najbolje = [...ocenjene].sort((a, b) => prosekOcena(b.id) - prosekOcena(a.id)).slice(0, 4);
    const sveOcene = biljke.flatMap(b => recenzijeBiljke(b.id));
    const ukupniProsek = sveOcene.reduce((s, r) => s + r.ocena, 0) / Math.max(1, sveOcene.length);

    let preporuke = "";
    if (korisnik && korisnik.omiljeneVrste.length) {
        const lista = biljke
            .filter(b => korisnik.omiljeneVrste.includes(b.category))
            .sort((a, b) => prosekOcena(b.id) - prosekOcena(a.id))
            .slice(0, 4);
        preporuke = `
        <section class="sekcija">
            <div class="sekcija-zaglavlje">
                <div>
                    <p class="nadnaslov">Na osnovu Vaših omiljenih vrsta</p>
                    <h2>Preporučeno za Vas, ${esc(korisnik.ime)}</h2>
                </div>
                <a href="#/profil" class="link-strelica">Izmeni omiljene vrste →</a>
            </div>
            <div class="mreza-biljaka">${lista.map(b => kartica(b)).join("")}</div>
        </section>`;
    }

    const istaknute = [biljke.find(b => b.name === "Monstera deliciosa"), biljke.find(b => b.name === "Lavanda"), biljke.find(b => b.name === "Jagoda")].filter(Boolean);

    aplikacija.innerHTML = `
    <section class="hero">
        <div class="hero-tekst">
            <p class="nadnaslov">Tvoj mali zeleni svet</p>
            <h1>Unesi prirodu<br>u svoj dom.</h1>
            <p class="hero-opis">Pretražite ${biljke.length} biljaka, rezervišite ih online i preuzmite kada Vama odgovara – bez plaćanja unapred.</p>
            <form class="hero-pretraga" data-forma="brzaPretraga" role="search">
                <label for="brzaPretraga" class="sr">Pretraži biljke po nazivu</label>
                <span class="hero-lupa" aria-hidden="true">🔍</span>
                <input id="brzaPretraga" name="tekst" type="search" placeholder="Npr. lavanda, monstera, jagoda…" autocomplete="off">
                <button class="dugme">Pretraži</button>
            </form>
            <p class="hero-savet">ili <a href="#/biljke">pregledajte ceo katalog</a> · <button class="dugme-tekst" data-akcija="agent">pitajte Zelenka za savet 🌱</button></p>
            <dl class="hero-statistika">
                <div><dt>Biljaka u ponudi</dt><dd>${biljke.length}</dd></div>
                <div><dt>Kategorija</dt><dd>${kategorije().length}</dd></div>
                <div><dt>Prosečna ocena kupaca</dt><dd>${ukupniProsek.toFixed(1).replace(".", ",")} ★</dd></div>
            </dl>
        </div>
        <div class="hero-kolaz" aria-hidden="true">
            ${istaknute.map((b, i) => `<a href="#/biljka/${b.id}" class="kolaz-${i}" tabindex="-1"><img src="${b.slika}" alt=""><span>${esc(b.name)}</span></a>`).join("")}
        </div>
    </section>

    ${preporuke}

    <section class="sekcija">
        <div class="sekcija-zaglavlje">
            <div>
                <p class="nadnaslov">Ručni pregled</p>
                <h2>Kategorije biljaka</h2>
            </div>
            <a href="#/biljke" class="link-strelica">Sve biljke →</a>
        </div>
        <div class="kategorije-mreza">
            ${kategorije().map(k => `
                <button class="kategorija-plocica" data-akcija="kategorija" data-kategorija="${esc(k.naziv)}">
                    <span class="kat-ikonica" aria-hidden="true">${IKONICE_KATEGORIJA[k.naziv] || "🌱"}</span>
                    <strong>${esc(k.naziv)}</strong>
                    <span>${k.broj} biljaka</span>
                </button>`).join("")}
        </div>
    </section>

    <section class="sekcija">
        <div class="sekcija-zaglavlje">
            <div>
                <p class="nadnaslov">Kupci preporučuju</p>
                <h2>Najbolje ocenjene biljke</h2>
            </div>
            <button class="link-strelica dugme-tekst" data-akcija="sortirajPoOceni">Sve po oceni →</button>
        </div>
        <div class="mreza-biljaka">${najbolje.map(b => kartica(b)).join("")}</div>
    </section>

    <section class="sekcija koraci">
        <h2>Kako funkcioniše rezervacija?</h2>
        <ol>
            <li><span>🔎</span><strong>Pronađite biljku</strong><p>Pretražite po nazivu, opisu, tipu, ciljnoj grupi, datumu proizvodnje, ceni ili recenzijama.</p></li>
            <li><span>📝</span><strong>Rezervišite</strong><p>Izaberite količinu, način i datum preuzimanja. Biljka odmah stiže u Vašu korpu rezervacija.</p></li>
            <li><span>📦</span><strong>Preuzmite i ocenite</strong><p>Kada biljka pristigne, preuzmite je i podelite utisak sa drugim kupcima.</p></li>
        </ol>
    </section>`;
}

// ---------- Katalog i pretraga ----------

function prikaziKatalog() {
    document.title = "Biljke – Zeleni Kutak";
    aplikacija.innerHTML = `
    <div class="stranica">
        <nav class="mrvice" aria-label="Putanja"><a href="#/">Početna</a><span>/</span><span>Biljke</span></nav>
        <header class="stranica-zaglavlje">
            <h1>Katalog biljaka</h1>
            <p>Pretražite ponudu po jednom od kriterijuma ili ručno pregledajte biljke po kategorijama.</p>
        </header>

        <section class="pretraga-panel" id="pretragaPanel" aria-label="Pretraga biljaka">${panelPretrage()}</section>

        <div class="kategorije-traka" role="group" aria-label="Pregled po kategoriji">
            <button class="cip ${stanje.kategorija === "" ? "aktivan" : ""}" data-akcija="kategorijaKatalog" data-kategorija="" aria-pressed="${stanje.kategorija === ""}">Sve kategorije <span>${biljke.length}</span></button>
            ${kategorije().map(k => `
                <button class="cip ${stanje.kategorija === k.naziv ? "aktivan" : ""}" data-akcija="kategorijaKatalog" data-kategorija="${esc(k.naziv)}" aria-pressed="${stanje.kategorija === k.naziv}">
                    ${IKONICE_KATEGORIJA[k.naziv]} ${esc(k.naziv)} <span>${k.broj}</span>
                </button>`).join("")}
        </div>

        <div class="rezultati-traka">
            <div class="rezultati-info">
                <p id="brojRezultata" aria-live="polite"></p>
                <div id="aktivnaPretraga"></div>
            </div>
            <label class="sortiranje">Sortiraj:
                <select data-promena="sortiranje">
                    ${Object.entries(SORTIRANJA).map(([k, v]) => `<option value="${k}" ${stanje.sortiranje === k ? "selected" : ""}>${v}</option>`).join("")}
                </select>
            </label>
        </div>

        <div id="rezultati" class="mreza-biljaka"></div>
        <div id="prikaziJos" class="prikazi-jos"></div>
    </div>`;
    prikaziRezultate();
}

function panelPretrage() {
    return `
        <div class="pretraga-naslov">
            <h2>Pretraga po kriterijumu</h2>
            <p>Izaberite kriterijum, unesite vrednost i pokrenite pretragu.</p>
        </div>
        <div class="pretraga-tabovi" role="tablist" aria-label="Kriterijum pretrage">
            ${KRITERIJUMI.map(k => `
                <button role="tab" class="tab ${k.kljuc === stanje.kriterijum ? "aktivan" : ""}" aria-selected="${k.kljuc === stanje.kriterijum}"
                    data-akcija="kriterijum" data-kriterijum="${k.kljuc}">
                    <span aria-hidden="true">${k.ikonica}</span> ${k.naslov}
                </button>`).join("")}
        </div>
        <form class="pretraga-forma" data-forma="pretraga" role="tabpanel" novalidate>
            ${formaKriterijuma(stanje.kriterijum)}
            <div class="pretraga-akcije">
                <p class="greska-forme" id="greskaPretrage" role="alert"></p>
                ${stanje.pretraga ? `<button type="button" class="dugme dugme-obrub" data-akcija="ponistiPretragu">Poništi pretragu</button>` : ""}
                <button class="dugme">🔍 Pretraži</button>
            </div>
        </form>`;
}

function formaKriterijuma(k) {
    const v = stanje.pretraga && stanje.pretraga.kriterijum === k ? stanje.pretraga.vrednosti : {};
    switch (k) {
        case "naziv":
            return `
            <div class="polje polje-siroko">
                <label for="pNaziv">Naziv biljke (srpski ili latinski)</label>
                <input id="pNaziv" name="tekst" type="search" value="${esc(v.tekst || "")}" placeholder="npr. ruža, Ficus, paradajz" autocomplete="off" data-uzivo>
                <small>Rezultati se prikazuju dok kucate. Nije bitno da li pišete sa kvačicama (š, č, ž…).</small>
            </div>`;
        case "opis":
            return `
            <div class="polje polje-siroko">
                <label for="pOpis">Reč ili pojam iz opisa, uputstva za sadnju ili negu</label>
                <input id="pOpis" name="tekst" type="search" value="${esc(v.tekst || "")}" placeholder="npr. drenaža, mraz, perlit, orezivanje" autocomplete="off">
                <div class="predlozi">Predlozi:
                    ${["drenažnim", "mraz", "perlit", "orezivanje", "precvetale", "busenom", "enterijer"].map(p => `<button type="button" class="cip cip-mali" data-akcija="predlog" data-polje="pOpis" data-vrednost="${p}">${p}</button>`).join("")}
                </div>
            </div>`;
        case "tip":
            return `
            <div class="polja-mreza">
                ${POLJA_TIPA.map(p => `
                <div class="polje">
                    <label for="t-${p.kljuc}">${p.naziv}</label>
                    <select id="t-${p.kljuc}" name="${p.kljuc}">
                        <option value="">Bilo koja</option>
                        ${vrednostiPolja(p.kljuc).map(x => `<option ${v[p.kljuc] === x ? "selected" : ""}>${esc(x)}</option>`).join("")}
                    </select>
                </div>`).join("")}
            </div>
            <small class="napomena-polja">Izaberite jednu ili više osobina tipa – prikazuju se biljke koje imaju sve izabrane osobine.</small>`;
        case "ciljna":
            return `
            <fieldset class="polje polje-siroko">
                <legend>Kome je biljka namenjena?</legend>
                <div class="izbor-mreza">
                    ${CILJNE_GRUPE.map(g => `
                    <label class="izbor-kartica">
                        <input type="radio" name="grupa" value="${esc(g.naziv)}" ${v.grupa === g.naziv ? "checked" : ""}>
                        <span><strong>${esc(g.naziv)}</strong><small>${esc(g.opis)}</small></span>
                    </label>`).join("")}
                </div>
            </fieldset>`;
        case "datum": {
            const datumi = biljke.map(b => b.production_date).sort();
            return `
            <div class="polja-red">
                <div class="polje">
                    <label for="pDatumOd">Proizvedeno od</label>
                    <input id="pDatumOd" name="od" type="date" value="${esc(v.od || "")}" min="${datumi[0]}" max="${datumi[datumi.length - 1]}">
                </div>
                <div class="polje">
                    <label for="pDatumDo">Proizvedeno do</label>
                    <input id="pDatumDo" name="do" type="date" value="${esc(v.do || "")}" min="${datumi[0]}" max="${datumi[datumi.length - 1]}">
                </div>
                <div class="predlozi predlozi-kolona">Brzi izbor:
                    <button type="button" class="cip cip-mali" data-akcija="brziDatum" data-od="2026-08-01" data-do="2026-09-30">Najsvežije (avg – sep)</button>
                    <button type="button" class="cip cip-mali" data-akcija="brziDatum" data-od="2026-03-01" data-do="2026-05-31">Prolećna proizvodnja</button>
                    <button type="button" class="cip cip-mali" data-akcija="brziDatum" data-od="2026-01-01" data-do="2026-02-28">Zimska proizvodnja</button>
                </div>
            </div>
            <small class="napomena-polja">Datum proizvodnje sadnica ili semena. U ponudi su biljke proizvedene od ${datum(datumi[0])} do ${datum(datumi[datumi.length - 1])}</small>`;
        }
        case "cena":
            return `
            <div class="polja-red">
                <div class="polje">
                    <label for="pCenaOd">Cena od (RSD)</label>
                    <input id="pCenaOd" name="min" type="number" min="0" step="10" value="${v.min ?? ""}" placeholder="npr. 500">
                </div>
                <div class="polje">
                    <label for="pCenaDo">Cena do (RSD)</label>
                    <input id="pCenaDo" name="max" type="number" min="0" step="10" value="${v.max ?? ""}" placeholder="npr. 1500">
                </div>
                <div class="predlozi predlozi-kolona">Brzi izbor:
                    ${[[0, 500, "do 500"], [500, 1000, "500 – 1.000"], [1000, 2000, "1.000 – 2.000"], [2000, "", "preko 2.000"]]
                        .map(([min, max, t]) => `<button type="button" class="cip cip-mali" data-akcija="brzaCena" data-min="${min}" data-max="${max}">${t}</button>`).join("")}
                </div>
            </div>`;
        case "recenzije":
            return `
            <fieldset class="polje polje-siroko">
                <legend>Najmanja prosečna ocena kupaca</legend>
                <div class="izbor-red">
                    ${[[4.5, "4,5 i više"], [4, "4 i više"], [3, "3 i više"], [0, "Bilo koja ocena"]].map(([o, t]) => `
                    <label class="izbor-cip">
                        <input type="radio" name="minOcena" value="${o}" ${Number(v.minOcena ?? 4) === o ? "checked" : ""}>
                        <span>${o ? zvezdice(o) : ""} ${t}</span>
                    </label>`).join("")}
                </div>
            </fieldset>
            <div class="polje polje-siroko">
                <label for="pRecenzija">Reč u tekstu recenzije (nije obavezno)</label>
                <input id="pRecenzija" name="tekst" type="search" value="${esc(v.tekst || "")}" placeholder="npr. upakovana, dostava, primila" autocomplete="off">
                <small>Prikazuju se samo biljke koje imaju recenzije kupaca koji su ih prethodno naručili.</small>
            </div>`;
    }
    return "";
}

function mestaPogotka(b, upit) {
    const mesta = [];
    if (sadrzi(b.description, upit)) mesta.push("opis");
    if (sadrzi(b.planting_instructions, upit)) mesta.push("sadnja");
    if (sadrzi(b.care_instructions, upit)) mesta.push("nega");
    return mesta;
}

function odgovaraPretrazi(b, pretraga) {
    const v = pretraga.vrednosti;
    switch (pretraga.kriterijum) {
        case "naziv": return sadrzi(b.name + " " + b.latin_name, v.tekst);
        case "opis": return mestaPogotka(b, v.tekst).length > 0;
        case "tip": return POLJA_TIPA.every(p => !v[p.kljuc] || b[p.kljuc] === v[p.kljuc]);
        case "ciljna": return b.target_audience === v.grupa;
        case "datum": return (!v.od || b.production_date >= v.od) && (!v.do || b.production_date <= v.do);
        case "cena": return (v.min == null || b.price >= v.min) && (v.max == null || b.price <= v.max);
        case "recenzije": {
            const r = recenzijeBiljke(b.id);
            if (!r.length || prosekOcena(b.id) < v.minOcena) return false;
            return !v.tekst || r.some(x => sadrzi(x.tekst, v.tekst));
        }
    }
    return true;
}

function sortiraj(lista) {
    const kopija = [...lista];
    switch (stanje.sortiranje) {
        case "cenaRastuce": return kopija.sort((a, b) => a.price - b.price);
        case "cenaOpadajuce": return kopija.sort((a, b) => b.price - a.price);
        case "ocena": return kopija.sort((a, b) => prosekOcena(b.id) - prosekOcena(a.id) || recenzijeBiljke(b.id).length - recenzijeBiljke(a.id).length);
        case "najnovije": return kopija.sort((a, b) => b.production_date.localeCompare(a.production_date));
        case "naziv": return kopija.sort((a, b) => a.name.localeCompare(b.name, "sr"));
    }
    return kopija;
}

function opisPogotka(b) {
    const p = stanje.pretraga;
    if (!p) return "";
    if (p.kriterijum === "opis") return "Pronađeno u: " + mestaPogotka(b, p.vrednosti.tekst).join(", ");
    if (p.kriterijum === "datum") return "Proizvedeno " + datum(b.production_date);
    if (p.kriterijum === "recenzije" && p.vrednosti.tekst) {
        const r = recenzijeBiljke(b.id).find(x => sadrzi(x.tekst, p.vrednosti.tekst));
        return r ? "„" + esc(r.tekst.length > 60 ? r.tekst.slice(0, 60) + "…" : r.tekst) + "”" : "";
    }
    return "";
}

function prikaziRezultate() {
    const kontejner = document.getElementById("rezultati");
    if (!kontejner) return;

    let lista = biljke;
    if (stanje.kategorija) lista = lista.filter(b => b.category === stanje.kategorija);
    if (stanje.pretraga) lista = lista.filter(b => odgovaraPretrazi(b, stanje.pretraga));
    lista = sortiraj(lista);

    const opseg = stanje.kategorija ? ` u kategoriji „${esc(stanje.kategorija)}”` : "";
    document.getElementById("brojRezultata").innerHTML = stanje.pretraga
        ? `Pronađeno: <strong>${mnozina(lista.length, "biljka", "biljke", "biljaka")}</strong>${opseg}`
        : `Prikaz: <strong>${mnozina(lista.length, "biljka", "biljke", "biljaka")}</strong>${opseg}`;

    document.getElementById("aktivnaPretraga").innerHTML = stanje.pretraga
        ? `<span class="cip-aktivno">🔍 ${stanje.pretraga.opis}
            <button data-akcija="ponistiPretragu" aria-label="Poništi pretragu" title="Poništi pretragu">✕</button></span>`
        : "";

    if (!lista.length) {
        kontejner.innerHTML = `
        <div class="prazno">
            <span aria-hidden="true">🍃</span>
            <h3>Nema biljaka za zadati kriterijum</h3>
            <p>Pokušajte sa drugim pojmom ili širim opsegom${stanje.kategorija ? ", ili pretražite sve kategorije" : ""}.</p>
            <div class="prazno-akcije">
                ${stanje.pretraga ? `<button class="dugme" data-akcija="ponistiPretragu">Poništi pretragu</button>` : ""}
                ${stanje.kategorija ? `<button class="dugme dugme-obrub" data-akcija="kategorijaKatalog" data-kategorija="">Sve kategorije</button>` : ""}
            </div>
        </div>`;
        document.getElementById("prikaziJos").innerHTML = "";
        return;
    }

    kontejner.innerHTML = lista.slice(0, stanje.prikazano).map(b => kartica(b, opisPogotka(b))).join("");
    const preostalo = lista.length - stanje.prikazano;
    document.getElementById("prikaziJos").innerHTML = preostalo > 0
        ? `<p>Prikazano ${stanje.prikazano} od ${lista.length}</p><button class="dugme dugme-obrub" data-akcija="prikaziJos">Prikaži još ${Math.min(24, preostalo)}</button>`
        : "";
}

function primeniPretragu(forma) {
    const podaci = new FormData(forma);
    const k = stanje.kriterijum;
    const v = {};
    let opis = "";
    let greska = "";
    const tekst = String(podaci.get("tekst") || "").trim();

    switch (k) {
        case "naziv":
            if (!tekst) greska = "Unesite naziv ili deo naziva biljke.";
            v.tekst = tekst;
            opis = `Naziv sadrži „${esc(tekst)}”`;
            break;
        case "opis":
            if (tekst.length < 3) greska = "Unesite bar 3 slova iz opisa, sadnje ili nege.";
            v.tekst = tekst;
            opis = `Opis, sadnja ili nega sadrži „${esc(tekst)}”`;
            break;
        case "tip":
            POLJA_TIPA.forEach(p => { if (podaci.get(p.kljuc)) v[p.kljuc] = podaci.get(p.kljuc); });
            if (!Object.keys(v).length) greska = "Izaberite bar jednu osobinu tipa biljke.";
            opis = "Tip: " + Object.values(v).map(esc).join(" · ");
            break;
        case "ciljna":
            v.grupa = podaci.get("grupa");
            if (!v.grupa) greska = "Izaberite ciljnu grupu.";
            opis = `Ciljna grupa: ${esc(v.grupa)}`;
            break;
        case "datum":
            v.od = podaci.get("od") || "";
            v.do = podaci.get("do") || "";
            if (!v.od && !v.do) greska = "Unesite bar jedan datum (od ili do).";
            else if (v.od && v.do && v.od > v.do) greska = "Datum „od” mora biti pre datuma „do”.";
            opis = "Proizvedeno " + (v.od ? "od " + datum(v.od) + " " : "") + (v.do ? "do " + datum(v.do) : "");
            break;
        case "cena":
            v.min = podaci.get("min") === "" ? null : Number(podaci.get("min"));
            v.max = podaci.get("max") === "" ? null : Number(podaci.get("max"));
            if (v.min == null && v.max == null) greska = "Unesite bar jednu granicu cene.";
            else if (v.min < 0 || v.max < 0) greska = "Cena ne može biti negativna.";
            else if (v.min != null && v.max != null && v.min > v.max) greska = "Najniža cena mora biti manja od najviše.";
            opis = "Cena " + (v.min != null ? "od " + cena(v.min) + " " : "") + (v.max != null ? "do " + cena(v.max) : "");
            break;
        case "recenzije":
            v.minOcena = Number(podaci.get("minOcena") || 0);
            v.tekst = tekst;
            opis = (v.minOcena ? "Prosečna ocena " + String(v.minOcena).replace(".", ",") + "★ i više" : "Biljke sa recenzijama") + (tekst ? ` · recenzija sadrži „${esc(tekst)}”` : "");
            break;
    }

    const polje = document.getElementById("greskaPretrage");
    if (greska) {
        polje.textContent = greska;
        return false;
    }
    polje.textContent = "";
    stanje.pretraga = { kriterijum: k, vrednosti: v, opis: opis };
    stanje.prikazano = 24;
    prikaziRezultate();
    return true;
}

function osveziPanelPretrage() {
    const panel = document.getElementById("pretragaPanel");
    if (panel) panel.innerHTML = panelPretrage();
}

// ---------- Stranica biljke ----------

function prikaziDetalje(id) {
    const b = biljkaPoId(id);
    if (!b) { prikaziNijePronadjeno(); return; }
    document.title = b.name + " – Zeleni Kutak";

    const recenzije = recenzijeBiljke(b.id);
    const prosek = prosekOcena(b.id);
    const raspodela = [5, 4, 3, 2, 1].map(o => ({ o, broj: recenzije.filter(r => r.ocena === o).length }));
    const uKorpi = korpa().filter(s => s.biljkaId === b.id && s.status === "rezervisano");
    const slicne = biljke.filter(x => x.category === b.category && x.id !== b.id)
        .sort((x, y) => prosekOcena(y.id) - prosekOcena(x.id)).slice(0, 4);

    aplikacija.innerHTML = `
    <div class="stranica">
        <nav class="mrvice" aria-label="Putanja">
            <a href="#/">Početna</a><span>/</span>
            <a href="#/biljke" data-akcija="kategorija" data-kategorija="${esc(b.category)}">${esc(b.category)}</a><span>/</span>
            <span>${esc(b.name)}</span>
        </nav>

        <article class="biljka-detalji">
            <div class="biljka-slika">
                <img src="${b.slika}" alt="${esc(b.image_alt)}">
                <span class="oznaka-oblik">${esc(b.plant_type)}</span>
            </div>

            <div class="biljka-info">
                <p class="kartica-kategorija">${IKONICE_KATEGORIJA[b.category]} ${esc(b.category)}</p>
                <h1>${esc(b.name)}</h1>
                <p class="latinski veliki">${esc(b.latin_name)}</p>

                <a class="ocena-sazetak" href="#recenzije" data-akcija="skrolujDo" data-cilj="recenzije">
                    ${recenzije.length ? `${zvezdice(prosek, "velike")} <strong>${prosek.toFixed(1).replace(".", ",")}</strong> <span>· ${brojRecenzijaTekst(recenzije.length)}</span>` : `<span class="bez-ocene">Još nema recenzija – budite prvi koji će oceniti ovu biljku</span>`}
                </a>

                <p class="biljka-opis">${esc(b.description)}</p>

                <div class="kupovina">
                    <div>
                        <strong class="cena velika">${cena(b.price)}</strong>
                        <span class="po-komadu">po komadu</span>
                    </div>
                    <p class="zaliha ${b.stock_quantity < 10 ? "malo" : ""}">${b.stock_quantity < 10 ? "⚠️ Još samo " + b.stock_quantity + " kom na stanju" : "✔ Na stanju: " + b.stock_quantity + " kom"}</p>
                    <button class="dugme dugme-veliko" data-akcija="rezervisi" data-id="${b.id}">Rezerviši biljku</button>
                    <p class="kupovina-napomena">Rezervacija je besplatna · plaćanje pri preuzimanju</p>
                    ${uKorpi.length ? `<p class="vec-u-korpi">🛒 Ova biljka je već u Vašoj korpi (${uKorpi.reduce((s, x) => s + x.kolicina, 0)} kom, status „Rezervisano”). <a href="#/korpa">Otvori korpu</a></p>` : ""}
                </div>

                <dl class="osobine">
                    <div><dt>Ciljna grupa</dt><dd>👥 ${esc(b.target_audience)}</dd></div>
                    <div><dt>Datum proizvodnje</dt><dd>📅 ${datum(b.production_date)}</dd></div>
                    ${POLJA_TIPA.map(p => `<div><dt>${p.naziv}</dt><dd>${esc(b[p.kljuc])}</dd></div>`).join("")}
                </dl>
            </div>
        </article>

        <section class="uputstva" aria-label="Sadnja i nega">
            <div class="uputstvo"><span aria-hidden="true">📖</span><h2>Opis</h2><p>${esc(b.description)}</p></div>
            <div class="uputstvo"><span aria-hidden="true">🌱</span><h2>Sadnja</h2><p>${esc(b.planting_instructions)}</p></div>
            <div class="uputstvo"><span aria-hidden="true">💧</span><h2>Nega</h2><p>${esc(b.care_instructions)}</p><p class="tiho">Svetlost: ${esc(b.light_requirement)} · Zalivanje: ${esc(b.watering)}</p></div>
        </section>

        <section class="recenzije-sekcija" id="recenzije" aria-labelledby="naslovRecenzija">
            <h2 id="naslovRecenzija">Recenzije kupaca</h2>
            <div class="recenzije-raspored">
                <aside class="recenzije-pregled">
                    ${recenzije.length ? `
                        <p class="prosek-veliki">${prosek.toFixed(1).replace(".", ",")}<span>/5</span></p>
                        ${zvezdice(prosek, "velike")}
                        <p class="tiho">${brojRecenzijaTekst(recenzije.length)}</p>
                        <ul class="raspodela">
                            ${raspodela.map(r => `<li><span>${r.o} ★</span><span class="traka"><span style="width:${recenzije.length ? r.broj / recenzije.length * 100 : 0}%"></span></span><span>${r.broj}</span></li>`).join("")}
                        </ul>` : `<p class="prosek-veliki">—</p><p class="tiho">Još nema ocena</p>`}
                    <p class="napomena-recenzije">ℹ️ Recenzije mogu ostaviti samo kupci kojima je ova biljka pristigla (status „Pristiglo” u korpi).</p>
                </aside>
                <div class="recenzije-lista">
                    ${recenzije.length ? recenzije.map(r => `
                    <article class="recenzija">
                        <header>
                            <span class="avatar mali">${esc(r.autor.split(" ").map(x => x[0]).join(""))}</span>
                            <div>
                                <strong>${esc(r.autor)}</strong>${korisnik && r.korisnik === korisnik.korisnickoIme ? ` <span class="vasa">Vaša recenzija</span>` : ""}
                                <span class="verifikovano">✔ Naručio/la ovu biljku · ${datum(r.datum)}</span>
                            </div>
                            ${zvezdice(r.ocena)}
                        </header>
                        ${r.tekst ? `<p>${esc(r.tekst)}</p>` : `<p class="tiho">Kupac je ostavio samo ocenu.</p>`}
                    </article>`).join("") : `
                    <div class="prazno malo">
                        <span aria-hidden="true">💬</span>
                        <p>Ova biljka još nema recenzija.</p>
                    </div>`}
                </div>
            </div>
        </section>

        ${slicne.length ? `
        <section class="sekcija bez-razmaka">
            <div class="sekcija-zaglavlje"><h2>Slične biljke</h2></div>
            <div class="mreza-biljaka">${slicne.map(x => kartica(x)).join("")}</div>
        </section>` : ""}
    </div>`;
}

// ---------- Rezervacija ----------

function zapocniRezervaciju(id) {
    const b = biljkaPoId(id);
    if (!korisnik) {
        stanje.posleRezervisi = b.id;
        stanje.posleRezervisiPutanja = "#/biljka/" + b.id;
        otvoriModal(`
            <div class="modal-zaglavlje">
                <h2 id="modalNaslov">Prijava je potrebna</h2>
                <button class="modal-zatvori" data-akcija="zatvoriModal" aria-label="Zatvori">✕</button>
            </div>
            <div class="modal-telo centrirano">
                <img class="modal-ilustracija" src="${b.slika}" alt="">
                <p>Da biste rezervisali biljku <strong>${esc(b.name)}</strong>, prijavite se na svoj nalog. Ako još nemate nalog, registracija traje manje od minut.</p>
                <p class="tiho">Posle prijave vraćamo Vas ovde i odmah otvaramo formu za rezervaciju.</p>
            </div>
            <div class="modal-akcije">
                <button class="dugme dugme-tekst" data-akcija="zatvoriModal">Nastavi pregled</button>
                <button class="dugme dugme-obrub" data-akcija="kaPrijavi" data-ruta="#/registracija">Registruj se</button>
                <button class="dugme" data-akcija="kaPrijavi" data-ruta="#/prijava">Prijavi se</button>
            </div>`);
        return;
    }
    otvoriFormuRezervacije(b);
}

function otvoriFormuRezervacije(b, stavka = null) {
    const maks = Math.min(b.stock_quantity, 10);
    const kolicina = stavka ? stavka.kolicina : 1;
    const preuzimanje = stavka ? stavka.preuzimanje : "radnja";
    const jedinicna = stavka ? stavka.cenaPoKomadu : b.price;

    otvoriModal(`
        <div class="modal-zaglavlje">
            <h2 id="modalNaslov">${stavka ? "Izmena rezervacije" : "Rezervacija biljke"}</h2>
            <button class="modal-zatvori" data-akcija="zatvoriModal" aria-label="Zatvori">✕</button>
        </div>
        <form data-forma="rezervacija" data-biljka="${b.id}" data-stavka="${stavka ? stavka.id : ""}" novalidate>
            <div class="modal-telo">
                <div class="mini-biljka">
                    <img src="${b.slika}" alt="">
                    <div>
                        <strong>${esc(b.name)}</strong>
                        <span>${esc(b.category)} · ${esc(b.plant_type)}</span>
                        <span>${cena(jedinicna)} po komadu</span>
                    </div>
                </div>

                <div class="polje">
                    <label for="rezKolicina">Količina</label>
                    <div class="brojac">
                        <button type="button" data-akcija="kolicina" data-smer="-1" aria-label="Smanji količinu">−</button>
                        <input id="rezKolicina" name="kolicina" type="number" min="1" max="${maks}" value="${kolicina}" inputmode="numeric">
                        <button type="button" data-akcija="kolicina" data-smer="1" aria-label="Povećaj količinu">+</button>
                    </div>
                    <small>Na stanju: ${b.stock_quantity} kom · najviše ${maks} po rezervaciji</small>
                </div>

                <fieldset class="polje">
                    <legend>Način preuzimanja</legend>
                    <div class="izbor-mreza dva">
                        <label class="izbor-kartica">
                            <input type="radio" name="preuzimanje" value="radnja" ${preuzimanje === "radnja" ? "checked" : ""}>
                            <span><strong>🏪 Lično preuzimanje</strong><small>Radnja: ${RADNJA_ADRESA}</small></span>
                        </label>
                        <label class="izbor-kartica">
                            <input type="radio" name="preuzimanje" value="dostava" ${preuzimanje === "dostava" ? "checked" : ""}>
                            <span><strong>🚚 Dostava na adresu</strong><small>${esc(korisnik.adresa)}, ${esc(korisnik.grad)}</small></span>
                        </label>
                    </div>
                </fieldset>

                <div class="polje">
                    <label for="rezDatum">Željeni datum preuzimanja</label>
                    <input id="rezDatum" name="datum" type="date" min="${danas(2)}" max="${danas(30)}" value="${stavka ? stavka.datumPreuzimanja : danas(3)}">
                    <small>Najranije za 2, a najkasnije za 30 dana.</small>
                </div>

                <div class="polje">
                    <label for="rezNapomena">Napomena <span class="tiho">(nije obavezno)</span></label>
                    <textarea id="rezNapomena" name="napomena" rows="2" maxlength="200" placeholder="npr. pakovanje za poklon, pozvati pre dostave…">${esc(stavka ? stavka.napomena : "")}</textarea>
                </div>

                <div class="rez-ukupno" data-cena="${jedinicna}">
                    <span>${cena(jedinicna)} × <b id="rezKol">${kolicina}</b> kom</span>
                    <strong id="rezUkupno">${cena(jedinicna * kolicina)}</strong>
                </div>
                <p class="greska-forme" id="greskaRezervacije" role="alert"></p>
            </div>
            <div class="modal-akcije">
                <button type="button" class="dugme dugme-obrub" data-akcija="zatvoriModal">Odustani</button>
                <button class="dugme">${stavka ? "Sačuvaj izmene" : "Potvrdi rezervaciju"}</button>
            </div>
        </form>`);
}

function osveziUkupnoRezervacije() {
    const polje = document.getElementById("rezKolicina");
    const okvir = document.querySelector(".rez-ukupno");
    if (!polje || !okvir) return;
    const kol = Math.max(0, Number(polje.value) || 0);
    document.getElementById("rezKol").textContent = kol;
    document.getElementById("rezUkupno").textContent = cena(Number(okvir.dataset.cena) * kol);
}

function sacuvajRezervaciju(forma) {
    const b = biljkaPoId(forma.dataset.biljka);
    const podaci = new FormData(forma);
    const kolicina = Number(podaci.get("kolicina"));
    const datumPreuzimanja = podaci.get("datum");
    const maks = Math.min(b.stock_quantity, 10);
    const greska = document.getElementById("greskaRezervacije");

    if (!Number.isInteger(kolicina) || kolicina < 1 || kolicina > maks) {
        greska.textContent = `Količina mora biti ceo broj od 1 do ${maks}.`;
        return;
    }
    if (!datumPreuzimanja || datumPreuzimanja < danas(2) || datumPreuzimanja > danas(30)) {
        greska.textContent = `Izaberite datum preuzimanja između ${datum(danas(2))} i ${datum(danas(30))}`;
        return;
    }

    const stavke = korpa();
    const podaciRezervacije = {
        kolicina: kolicina,
        preuzimanje: podaci.get("preuzimanje"),
        datumPreuzimanja: datumPreuzimanja,
        napomena: String(podaci.get("napomena") || "").trim()
    };

    if (forma.dataset.stavka) {
        const stavka = stavke.find(s => s.id === forma.dataset.stavka);
        if (!stavka || stavka.status !== "rezervisano") {
            greska.textContent = "Rezervacija se može menjati samo dok je u statusu „Rezervisano”.";
            return;
        }
        Object.assign(stavka, podaciRezervacije);
        sacuvajKorpu(stavke);
        zatvoriModal();
        obavesti(`Izmene rezervacije za <strong>${esc(b.name)}</strong> su sačuvane. Nova cena: ${cena(stavka.cenaPoKomadu * kolicina)}.`, "uspeh");
        prikaziKorpu();
        return;
    }

    stavke.push(Object.assign({
        id: "r" + Date.now().toString(36),
        biljkaId: b.id,
        cenaPoKomadu: b.price,
        status: "rezervisano",
        datumRezervacije: danas(),
        ocena: null
    }, podaciRezervacije));
    sacuvajKorpu(stavke);
    zatvoriModal();
    animirajKorpu();
    obavesti(`<strong>${esc(b.name)}</strong> je rezervisana (${kolicina} kom · ${cena(b.price * kolicina)}) i dodata u korpu rezervacija sa statusom „Rezervisano”.`,
        "uspeh", { tekst: "Otvori korpu", ruta: "#/korpa" }, "Rezervacija je uspela 🌱");

    if (location.hash.startsWith("#/biljka/")) prikaziDetalje(b.id);
}

// ---------- Korpa rezervacija ----------

function prikaziKorpu() {
    document.title = "Korpa rezervacija – Zeleni Kutak";
    const stavke = korpa();
    const poStatusu = s => stavke.filter(x => x.status === s);
    const zbir = lista => lista.reduce((s, x) => s + x.cenaPoKomadu * x.kolicina, 0);
    const rezervisano = poStatusu("rezervisano");
    const pristiglo = poStatusu("pristiglo");
    const otkazano = poStatusu("otkazano");
    const ukupno = zbir(rezervisano) + zbir(pristiglo);

    const filter = stanje.filterKorpe;
    const prikazane = filter === "sve" ? stavke : poStatusu(filter);
    const redosled = { rezervisano: 0, pristiglo: 1, otkazano: 2 };
    prikazane.sort((a, b) => redosled[a.status] - redosled[b.status] || b.datumRezervacije.localeCompare(a.datumRezervacije));

    const tab = (kljuc, naziv, broj) => `
        <button role="tab" class="tab ${filter === kljuc ? "aktivan" : ""}" aria-selected="${filter === kljuc}" data-akcija="filterKorpe" data-filter="${kljuc}">
            ${naziv} <span class="broj">${broj}</span>
        </button>`;

    aplikacija.innerHTML = `
    <div class="stranica">
        <nav class="mrvice" aria-label="Putanja"><a href="#/">Početna</a><span>/</span><span>Korpa rezervacija</span></nav>
        <header class="stranica-zaglavlje">
            <h1>Korpa rezervacija</h1>
            <p>Pregled svih biljaka koje ste rezervisali, njihovih statusa i ukupne cene.</p>
        </header>

        ${!stavke.length ? `
        <div class="prazno veliko">
            <span aria-hidden="true">🛒</span>
            <h2>Vaša korpa je prazna</h2>
            <p>Pronađite biljku koja Vam se dopada i rezervišite je – pojaviće se ovde.</p>
            <a class="dugme" href="#/biljke">Istraži biljke →</a>
        </div>` : `
        <div class="korpa-raspored">
            <section>
                <div class="pretraga-tabovi korpa-tabovi" role="tablist" aria-label="Filter po statusu">
                    ${tab("sve", "Sve", stavke.length)}
                    ${tab("rezervisano", STATUSI.rezervisano.ikonica + " Rezervisano", rezervisano.length)}
                    ${tab("pristiglo", STATUSI.pristiglo.ikonica + " Pristiglo", pristiglo.length)}
                    ${tab("otkazano", STATUSI.otkazano.ikonica + " Otkazano", otkazano.length)}
                </div>
                <div class="stavke-korpe">
                    ${prikazane.length ? prikazane.map(stavkaKorpe).join("") : `
                    <div class="prazno malo"><span aria-hidden="true">🍃</span><p>Nema biljaka u statusu „${STATUSI[filter].naziv}”.</p></div>`}
                </div>
            </section>

            <aside class="korpa-pregled" aria-label="Pregled cene">
                <h2>Pregled</h2>
                <dl class="pregled-cene">
                    <div><dt>🕓 Rezervisano <small>${mnozina(rezervisano.length, "biljka", "biljke", "biljaka")} · ${rezervisano.reduce((s, x) => s + x.kolicina, 0)} kom</small></dt><dd>${cena(zbir(rezervisano))}</dd></div>
                    <div><dt>📦 Pristiglo <small>${mnozina(pristiglo.length, "biljka", "biljke", "biljaka")} · ${pristiglo.reduce((s, x) => s + x.kolicina, 0)} kom</small></dt><dd>${cena(zbir(pristiglo))}</dd></div>
                    <div class="precrtano"><dt>✖ Otkazano <small>ne ulazi u ukupnu cenu</small></dt><dd>${cena(zbir(otkazano))}</dd></div>
                    <div class="ukupno"><dt>Ukupna cena</dt><dd>${cena(ukupno)}</dd></div>
                </dl>
                <p class="tiho">Za plaćanje pri preuzimanju: <strong>${cena(zbir(rezervisano))}</strong></p>
                <details class="pravila" open>
                    <summary>Pravila korpe</summary>
                    <ul>
                        <li><b>Rezervisano</b> – možete menjati količinu, način i datum preuzimanja ili otkazati.</li>
                        <li><b>Pristiglo</b> – možete oceniti biljku i ukloniti je iz korpe.</li>
                        <li><b>Otkazano</b> – ne računa se u cenu; možete je ukloniti ili ponovo rezervisati.</li>
                    </ul>
                </details>
                <a class="dugme dugme-obrub puna-sirina" href="#/biljke">+ Rezerviši još biljaka</a>
            </aside>
        </div>`}
    </div>`;
}

function stavkaKorpe(s) {
    const b = biljkaPoId(s.biljkaId);
    if (!b) return "";
    const status = STATUSI[s.status];
    let akcije = "";

    if (s.status === "rezervisano") {
        akcije = `
            <button class="dugme dugme-malo" data-akcija="izmeniStavku" data-id="${s.id}">✏️ Izmeni</button>
            <button class="dugme dugme-malo dugme-obrub opasno" data-akcija="otkaziStavku" data-id="${s.id}">Otkaži rezervaciju</button>
            <button class="dugme-tekst simulacija" data-akcija="simulirajDolazak" data-id="${s.id}" title="Samo za demonstraciju prototipa – u stvarnoj aplikaciji status menja prodavnica">⚙ Simuliraj pristizanje</button>`;
    } else if (s.status === "pristiglo") {
        akcije = s.ocena
            ? `<span class="moja-ocena">Vaša ocena: ${zvezdice(s.ocena)} <b>${OPISI_OCENA[s.ocena]}</b></span>
               <button class="dugme dugme-malo dugme-obrub" data-akcija="oceniStavku" data-id="${s.id}">Izmeni ocenu</button>`
            : `<button class="dugme dugme-malo dugme-ocena" data-akcija="oceniStavku" data-id="${s.id}">⭐ Oceni biljku</button>`;
        akcije += `<button class="dugme dugme-malo dugme-obrub opasno" data-akcija="ukloniStavku" data-id="${s.id}">🗑 Ukloni iz korpe</button>`;
    } else {
        akcije = `
            <button class="dugme dugme-malo dugme-obrub" data-akcija="rezervisi" data-id="${b.id}">Rezerviši ponovo</button>
            <button class="dugme dugme-malo dugme-obrub opasno" data-akcija="ukloniStavku" data-id="${s.id}">🗑 Ukloni iz korpe</button>`;
    }

    return `
    <article class="stavka status-${s.status}">
        <a href="#/biljka/${b.id}" class="stavka-slika" tabindex="-1" aria-hidden="true"><img src="${b.slika}" alt=""></a>
        <div class="stavka-telo">
            <header class="stavka-zaglavlje">
                <div>
                    <h3><a href="#/biljka/${b.id}">${esc(b.name)}</a></h3>
                    <p class="tiho">${esc(b.latin_name)} · ${esc(b.category)} · ${esc(b.plant_type)}</p>
                </div>
                <span class="status-oznaka ${s.status}" title="${status.opis}">${status.ikonica} ${status.naziv}</span>
            </header>

            <dl class="stavka-podaci">
                <div><dt>Količina</dt><dd>${s.kolicina} kom</dd></div>
                <div><dt>Cena po kom</dt><dd>${cena(s.cenaPoKomadu)}</dd></div>
                <div><dt>Preuzimanje</dt><dd>${s.preuzimanje === "dostava" ? "🚚 Dostava" : "🏪 U radnji"}</dd></div>
                <div><dt>${s.status === "pristiglo" ? "Pristiglo" : "Datum preuzimanja"}</dt><dd>${datum(s.datumPreuzimanja)}</dd></div>
                <div><dt>Rezervisano</dt><dd>${datum(s.datumRezervacije)}</dd></div>
                <div><dt>Ciljna grupa</dt><dd>${esc(b.target_audience)}</dd></div>
                <div><dt>Podneblje · sezona</dt><dd>${esc(b.climate)} · ${esc(b.season)}</dd></div>
                <div><dt>Proizvedeno</dt><dd>${datum(b.production_date)}</dd></div>
            </dl>
            ${s.napomena ? `<p class="stavka-napomena">📝 ${esc(s.napomena)}</p>` : ""}
            <details class="stavka-vise">
                <summary>Opis, sadnja i nega</summary>
                <p><b>Opis:</b> ${esc(b.description)}</p>
                <p><b>Sadnja:</b> ${esc(b.planting_instructions)}</p>
                <p><b>Nega:</b> ${esc(b.care_instructions)} (svetlost: ${esc(b.light_requirement)}, zalivanje: ${esc(b.watering)})</p>
            </details>

            <footer class="stavka-dno">
                <div class="stavka-akcije">${akcije}</div>
                <strong class="cena ${s.status === "otkazano" ? "precrtana" : ""}">${cena(s.cenaPoKomadu * s.kolicina)}</strong>
            </footer>
        </div>
    </article>`;
}

function nadjiStavku(id) {
    const stavke = korpa();
    return { stavke, stavka: stavke.find(s => s.id === id) };
}

function otkaziStavku(id) {
    const { stavke, stavka } = nadjiStavku(id);
    const b = biljkaPoId(stavka.biljkaId);
    potvrdi({
        naslov: "Otkazati rezervaciju?",
        poruka: `Rezervacija biljke <strong>${esc(b.name)}</strong> (${stavka.kolicina} kom) biće otkazana i neće se računati u ukupnu cenu. Biljku možete kasnije ponovo rezervisati.`,
        dugme: "Da, otkaži rezervaciju",
        odustani: "Ne, zadrži",
        opasno: true
    }, () => {
        stavka.status = "otkazano";
        sacuvajKorpu(stavke);
        obavesti(`Rezervacija biljke <strong>${esc(b.name)}</strong> je otkazana.`, "info");
        prikaziKorpu();
    });
}

function ukloniStavku(id) {
    const { stavke, stavka } = nadjiStavku(id);
    const b = biljkaPoId(stavka.biljkaId);
    if (stavka.status === "rezervisano") {
        obavesti("Biljka u statusu „Rezervisano” ne može se ukloniti – prvo otkažite rezervaciju.", "greska");
        return;
    }
    potvrdi({
        naslov: "Ukloniti biljku iz korpe?",
        poruka: `<strong>${esc(b.name)}</strong> će biti trajno uklonjena iz korpe rezervacija.${stavka.ocena ? " Vaša ocena i recenzija ostaju vidljive na stranici biljke." : ""}`,
        dugme: "Ukloni iz korpe",
        odustani: "Odustani",
        opasno: true
    }, () => {
        sacuvajKorpu(stavke.filter(s => s.id !== id));
        obavesti(`<strong>${esc(b.name)}</strong> je uklonjena iz korpe.`, "info");
        prikaziKorpu();
    });
}

function simulirajDolazak(id) {
    const { stavke, stavka } = nadjiStavku(id);
    const b = biljkaPoId(stavka.biljkaId);
    stavka.status = "pristiglo";
    stavka.datumPreuzimanja = danas();
    sacuvajKorpu(stavke);
    obavesti(`📦 <strong>${esc(b.name)}</strong> je pristigla! Sada je možete oceniti.`, "uspeh", { tekst: "Oceni odmah", akcija: () => otvoriOcenjivanje(id) });
    prikaziKorpu();
}

function otvoriOcenjivanje(id) {
    const { stavka } = nadjiStavku(id);
    if (!stavka || stavka.status !== "pristiglo") {
        obavesti("Ocenjivati se mogu samo biljke u statusu „Pristiglo”.", "greska");
        return;
    }
    const b = biljkaPoId(stavka.biljkaId);
    const postojeca = korisnickeRecenzije().find(r => r.stavkaId === id);

    otvoriModal(`
        <div class="modal-zaglavlje">
            <h2 id="modalNaslov">${stavka.ocena ? "Izmena ocene" : "Ocenite biljku"}</h2>
            <button class="modal-zatvori" data-akcija="zatvoriModal" aria-label="Zatvori">✕</button>
        </div>
        <form data-forma="ocena" data-stavka="${id}" novalidate>
            <div class="modal-telo">
                <div class="mini-biljka">
                    <img src="${b.slika}" alt="">
                    <div>
                        <strong>${esc(b.name)}</strong>
                        <span>Pristiglo ${datum(stavka.datumPreuzimanja)} · ${stavka.kolicina} kom</span>
                    </div>
                </div>
                <fieldset class="polje centrirano">
                    <legend>Koliko ste zadovoljni biljkom?</legend>
                    <div class="zvezde-unos">
                        ${[5, 4, 3, 2, 1].map(o => `
                        <input type="radio" id="oc${o}" name="ocena" value="${o}" ${stavka.ocena === o ? "checked" : ""}>
                        <label for="oc${o}" title="${OPISI_OCENA[o]}" aria-label="${o} – ${OPISI_OCENA[o]}">★</label>`).join("")}
                    </div>
                    <p class="ocena-opis" id="ocenaOpis">${stavka.ocena ? OPISI_OCENA[stavka.ocena] : "Kliknite na zvezdicu"}</p>
                </fieldset>
                <div class="polje">
                    <label for="ocenaTekst">Recenzija <span class="tiho">(nije obavezno)</span></label>
                    <textarea id="ocenaTekst" name="tekst" rows="3" maxlength="300" placeholder="Kako je biljka stigla? Kako napreduje?">${esc(postojeca ? postojeca.tekst : "")}</textarea>
                    <small>Recenzija će biti javno prikazana na stranici biljke, uz Vaše ime i inicijal prezimena.</small>
                </div>
                <p class="greska-forme" id="greskaOcene" role="alert"></p>
            </div>
            <div class="modal-akcije">
                <button type="button" class="dugme dugme-obrub" data-akcija="zatvoriModal">Odustani</button>
                <button class="dugme">Sačuvaj ocenu</button>
            </div>
        </form>`);
}

function sacuvajOcenu(forma) {
    const id = forma.dataset.stavka;
    const ocena = Number(new FormData(forma).get("ocena"));
    const tekst = String(new FormData(forma).get("tekst") || "").trim();
    if (!ocena) {
        document.getElementById("greskaOcene").textContent = "Izaberite ocenu od 1 do 5 zvezdica.";
        return;
    }
    const { stavke, stavka } = nadjiStavku(id);
    if (stavka.status !== "pristiglo") return;
    stavka.ocena = ocena;
    sacuvajKorpu(stavke);

    const recenzije = korisnickeRecenzije().filter(r => r.stavkaId !== id);
    recenzije.push({
        id: "k-" + id, stavkaId: id, biljkaId: stavka.biljkaId,
        autor: korisnik.ime + " " + korisnik.prezime[0] + ".", korisnik: korisnik.korisnickoIme,
        ocena: ocena, tekst: tekst, datum: danas()
    });
    sacuvaj("zk_recenzije", recenzije);

    zatvoriModal();
    const b = biljkaPoId(stavka.biljkaId);
    obavesti(`Hvala! Ocena ${"★".repeat(ocena)} za <strong>${esc(b.name)}</strong> je sačuvana i vidljiva drugim kupcima.`, "uspeh", { tekst: "Pogledaj recenziju", ruta: "#/biljka/" + b.id });
    prikaziKorpu();
}

// ---------- Prijava i registracija ----------

function prikaziPrijavu() {
    document.title = "Prijava – Zeleni Kutak";
    const poruka = stanje.porukaPrijave;
    stanje.porukaPrijave = "";
    aplikacija.innerHTML = `
    <div class="stranica forma-stranica">
        <section class="forma-kartica">
            <span class="forma-ikonica" aria-hidden="true">🔑</span>
            <h1>Prijava</h1>
            <p class="tiho">Prijavite se da biste rezervisali biljke i pristupili korpi.</p>
            ${poruka ? `<p class="upozorenje">ℹ️ ${esc(poruka)}</p>` : ""}
            <form data-forma="prijava" novalidate>
                <div class="polje">
                    <label for="prKorisnik">Korisničko ime ili email</label>
                    <input id="prKorisnik" name="korisnik" autocomplete="username" required>
                </div>
                <div class="polje">
                    <label for="prLozinka">Lozinka</label>
                    <div class="lozinka-polje">
                        <input id="prLozinka" name="lozinka" type="password" autocomplete="current-password" required>
                        <button type="button" class="dugme-tekst" data-akcija="prikaziLozinku" data-polje="prLozinka">Prikaži</button>
                    </div>
                </div>
                <p class="greska-forme" id="greskaPrijave" role="alert"></p>
                <button class="dugme puna-sirina dugme-veliko">Prijavi se</button>
            </form>
            <p class="forma-prelaz">Nemate nalog? <a href="#/registracija">Registrujte se</a></p>
            <div class="demo-nalog">
                <p><strong>Demo nalog za proveru prototipa</strong><br>korisničko ime: <code>jelena</code> · lozinka: <code>biljke123</code></p>
                <button type="button" class="dugme dugme-malo dugme-obrub" data-akcija="popuniDemo">Popuni demo podatke</button>
            </div>
        </section>
    </div>`;
}

function prijaviSe(forma) {
    const podaci = new FormData(forma);
    const unos = normalizuj(String(podaci.get("korisnik")).trim());
    const lozinka = String(podaci.get("lozinka"));
    const greska = document.getElementById("greskaPrijave");

    if (!unos || !lozinka) {
        greska.textContent = "Unesite korisničko ime (ili email) i lozinku.";
        return;
    }
    const nadjen = sviKorisnici().find(k => (normalizuj(k.korisnickoIme) === unos || normalizuj(k.email) === unos) && k.lozinka === lozinka);
    if (!nadjen) {
        greska.textContent = "Pogrešno korisničko ime ili lozinka. Proverite unos i pokušajte ponovo.";
        forma.lozinka.value = "";
        forma.lozinka.focus();
        return;
    }
    zavrsiPrijavu(nadjen, `Dobro došli nazad, <strong>${esc(nadjen.ime)}</strong>!`);
}

function zavrsiPrijavu(k, poruka) {
    korisnik = k;
    sacuvaj("zk_sesija", k.korisnickoIme);
    osveziZaglavlje();
    obavesti(poruka, "uspeh");
    const cilj = stanje.posleRezervisi ? stanje.posleRezervisiPutanja : (stanje.poslePrijave || "#/");
    stanje.poslePrijave = null;
    idi(cilj);
}

function odjaviSe() {
    korisnik = null;
    sacuvaj("zk_sesija", null);
    stanje.izmenaProfila = false;
    osveziZaglavlje();
    obavesti("Uspešno ste se odjavili. Vidimo se uskoro! 🌿", "info");
    idi("#/");
}

function poljaProfila(p, nov) {
    const polje = (ime, natpis, tip = "text", dodatno = "") => `
        <div class="polje">
            <label for="f-${ime}">${natpis} <span class="obavezno" aria-hidden="true">*</span></label>
            <input id="f-${ime}" name="${ime}" type="${tip}" value="${esc(p[ime] || "")}" required aria-describedby="g-${ime}" ${dodatno}>
            <small class="greska" id="g-${ime}"></small>
        </div>`;

    return `
        <fieldset class="grupa-polja">
            <legend>Lični podaci</legend>
            <div class="polja-red">
                ${polje("ime", "Ime", "text", 'autocomplete="given-name"')}
                ${polje("prezime", "Prezime", "text", 'autocomplete="family-name"')}
            </div>
        </fieldset>
        <fieldset class="grupa-polja">
            <legend>Kontakt podaci</legend>
            <div class="polja-red">
                ${polje("email", "Email", "email", 'autocomplete="email" placeholder="ime@primer.rs"')}
                ${polje("telefon", "Telefon", "tel", 'autocomplete="tel" placeholder="064 123 4567"')}
            </div>
            ${polje("adresa", "Adresa (ulica i broj)", "text", 'autocomplete="street-address"')}
            <div class="polja-red">
                ${polje("grad", "Grad", "text", 'autocomplete="address-level2"')}
                ${polje("postanskiBroj", "Poštanski broj", "text", 'inputmode="numeric" maxlength="5" autocomplete="postal-code"')}
            </div>
        </fieldset>
        <fieldset class="grupa-polja">
            <legend>Omiljene vrste biljaka <span class="obavezno" aria-hidden="true">*</span></legend>
            <p class="tiho">Izaberite bar jednu – na osnovu njih dobijate preporuke na početnoj stranici.</p>
            <div class="izbor-red">
                ${kategorije().map(k => `
                <label class="izbor-cip">
                    <input type="checkbox" name="omiljeneVrste" value="${esc(k.naziv)}" ${(p.omiljeneVrste || []).includes(k.naziv) ? "checked" : ""}>
                    <span>${IKONICE_KATEGORIJA[k.naziv]} ${esc(k.naziv)}</span>
                </label>`).join("")}
            </div>
            <small class="greska" id="g-omiljeneVrste"></small>
        </fieldset>
        ${nov ? `
        <fieldset class="grupa-polja">
            <legend>Podaci za prijavu</legend>
            ${polje("korisnickoIme", "Korisničko ime", "text", 'autocomplete="username" placeholder="npr. ana.biljke"')}
            <div class="polja-red">
                ${polje("lozinka", "Lozinka", "password", 'autocomplete="new-password"')}
                ${polje("potvrda", "Potvrda lozinke", "password", 'autocomplete="new-password"')}
            </div>
            <small class="tiho">Lozinka mora imati bar 6 znakova i bar jednu cifru.</small>
        </fieldset>` : ""}`;
}

function prikaziRegistraciju() {
    document.title = "Registracija – Zeleni Kutak";
    aplikacija.innerHTML = `
    <div class="stranica forma-stranica">
        <section class="forma-kartica siroka">
            <span class="forma-ikonica" aria-hidden="true">✨</span>
            <h1>Registracija</h1>
            <p class="tiho">Napravite nalog da biste rezervisali biljke. Sva polja označena sa <span class="obavezno">*</span> su obavezna.</p>
            <form data-forma="registracija" novalidate>
                ${poljaProfila({ omiljeneVrste: [] }, true)}
                <p class="greska-forme" id="greskaRegistracije" role="alert"></p>
                <button class="dugme puna-sirina dugme-veliko">Napravi nalog</button>
            </form>
            <p class="forma-prelaz">Već imate nalog? <a href="#/prijava">Prijavite se</a></p>
        </section>
    </div>`;
}

function podaciIzForme(forma) {
    const podaci = new FormData(forma);
    const p = {};
    ["ime", "prezime", "email", "telefon", "adresa", "grad", "postanskiBroj", "korisnickoIme", "lozinka", "potvrda"].forEach(k => {
        if (podaci.has(k)) p[k] = String(podaci.get(k)).trim();
    });
    p.omiljeneVrste = podaci.getAll("omiljeneVrste");
    return p;
}

function proveriProfil(p, nov, trenutno) {
    const g = {};
    const drugi = sviKorisnici().filter(k => !trenutno || k.korisnickoIme !== trenutno);
    if (!p.ime) g.ime = "Unesite ime.";
    if (!p.prezime) g.prezime = "Unesite prezime.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email)) g.email = "Unesite ispravnu email adresu (npr. ime@primer.rs).";
    else if (drugi.some(k => k.email.toLowerCase() === p.email.toLowerCase())) g.email = "Nalog sa ovom email adresom već postoji.";
    if (!/^\+?[0-9\s/-]{8,}$/.test(p.telefon)) g.telefon = "Unesite broj telefona (npr. 064 123 4567).";
    if (!p.adresa) g.adresa = "Unesite ulicu i broj.";
    if (!p.grad) g.grad = "Unesite grad.";
    if (!/^\d{5}$/.test(p.postanskiBroj)) g.postanskiBroj = "Poštanski broj ima 5 cifara.";
    if (!p.omiljeneVrste.length) g.omiljeneVrste = "Izaberite bar jednu omiljenu vrstu biljaka.";
    if (nov) {
        if (!/^[a-zA-Z0-9._]{3,20}$/.test(p.korisnickoIme)) g.korisnickoIme = "3–20 znakova: slova bez kvačica, cifre, tačka ili donja crta.";
        else if (drugi.some(k => k.korisnickoIme.toLowerCase() === p.korisnickoIme.toLowerCase())) g.korisnickoIme = "Ovo korisničko ime je zauzeto.";
        if (p.lozinka.length < 6 || !/\d/.test(p.lozinka)) g.lozinka = "Bar 6 znakova i bar jedna cifra.";
        if (!p.potvrda || p.potvrda !== p.lozinka) g.potvrda = "Lozinke se ne poklapaju.";
    }
    return g;
}

function prikaziGreske(forma, greske) {
    forma.querySelectorAll(".greska").forEach(el => { el.textContent = ""; });
    forma.querySelectorAll("[aria-invalid]").forEach(el => el.removeAttribute("aria-invalid"));
    Object.entries(greske).forEach(([kljuc, poruka]) => {
        const el = forma.querySelector("#g-" + kljuc);
        if (el) el.textContent = poruka;
        const polje = forma.querySelector(`[name="${kljuc}"]`);
        if (polje) polje.setAttribute("aria-invalid", "true");
    });
    const prvo = forma.querySelector("[aria-invalid]");
    if (prvo) prvo.focus();
}

function registrujSe(forma) {
    const p = podaciIzForme(forma);
    const greske = proveriProfil(p, true);
    prikaziGreske(forma, greske);
    const broj = Object.keys(greske).length;
    document.getElementById("greskaRegistracije").textContent = broj ? `Proverite označena polja (${broj}).` : "";
    if (broj) return;

    const nov = {
        korisnickoIme: p.korisnickoIme, lozinka: p.lozinka,
        ime: p.ime, prezime: p.prezime, email: p.email, telefon: p.telefon,
        adresa: p.adresa, grad: p.grad, postanskiBroj: p.postanskiBroj,
        omiljeneVrste: p.omiljeneVrste, clanOd: danas()
    };
    sacuvaj("zk_korisnici", sviKorisnici().concat(nov));
    zavrsiPrijavu(nov, `Nalog je napravljen. Dobro došli u Zeleni Kutak, <strong>${esc(nov.ime)}</strong>! 🌱`);
}

// ---------- Profil ----------

function prikaziProfil() {
    document.title = "Moj profil – Zeleni Kutak";
    const stavke = korpa();
    const k = korisnik;
    const statistika = [
        ["Rezervisano", stavke.filter(s => s.status === "rezervisano").length],
        ["Pristiglo", stavke.filter(s => s.status === "pristiglo").length],
        ["Datih ocena", korisnickeRecenzije().filter(r => r.korisnik === k.korisnickoIme).length]
    ];

    aplikacija.innerHTML = `
    <div class="stranica">
        <nav class="mrvice" aria-label="Putanja"><a href="#/">Početna</a><span>/</span><span>Moj profil</span></nav>
        <div class="profil-raspored">
            <aside class="profil-kartica">
                <span class="avatar veliki">${esc(inicijali(k.ime, k.prezime))}</span>
                <h1>${esc(k.ime + " " + k.prezime)}</h1>
                <p class="tiho">@${esc(k.korisnickoIme)} · član od ${datum(k.clanOd)}</p>
                <dl class="profil-statistika">
                    ${statistika.map(([n, v]) => `<div><dd>${v}</dd><dt>${n}</dt></div>`).join("")}
                </dl>
                <a class="dugme puna-sirina" href="#/korpa">🛒 Moja korpa rezervacija</a>
                <button class="dugme dugme-obrub puna-sirina" data-akcija="promeniLozinku">🔒 Promeni lozinku</button>
                <button class="dugme-tekst" data-akcija="odjava">Odjavi se</button>
            </aside>

            <section class="profil-sadrzaj">
                ${stanje.izmenaProfila ? `
                <div class="profil-zaglavlje">
                    <h2>Izmena podataka profila</h2>
                </div>
                <form data-forma="profil" novalidate>
                    ${poljaProfila(k, false)}
                    <p class="greska-forme" id="greskaProfila" role="alert"></p>
                    <div class="forma-akcije">
                        <button type="button" class="dugme dugme-obrub" data-akcija="odustaniProfil">Odustani</button>
                        <button class="dugme">Sačuvaj izmene</button>
                    </div>
                </form>` : `
                <div class="profil-zaglavlje">
                    <h2>Podaci profila</h2>
                    <button class="dugme dugme-malo" data-akcija="izmeniProfil">✏️ Izmeni podatke</button>
                </div>
                <div class="profil-blokovi">
                    <section class="profil-blok">
                        <h3>Lični podaci</h3>
                        <dl><div><dt>Ime</dt><dd>${esc(k.ime)}</dd></div><div><dt>Prezime</dt><dd>${esc(k.prezime)}</dd></div></dl>
                    </section>
                    <section class="profil-blok">
                        <h3>Kontakt podaci</h3>
                        <dl>
                            <div><dt>Email</dt><dd>${esc(k.email)}</dd></div>
                            <div><dt>Telefon</dt><dd>${esc(k.telefon)}</dd></div>
                            <div><dt>Adresa</dt><dd>${esc(k.adresa)}, ${esc(k.postanskiBroj)} ${esc(k.grad)}</dd></div>
                        </dl>
                    </section>
                    <section class="profil-blok">
                        <h3>Omiljene vrste biljaka</h3>
                        <div class="izbor-red">${k.omiljeneVrste.map(v => `<a class="cip" href="#/biljke?kategorija=${encodeURIComponent(v)}">${IKONICE_KATEGORIJA[v] || ""} ${esc(v)}</a>`).join("")}</div>
                    </section>
                    <section class="profil-blok">
                        <h3>Podaci za prijavu</h3>
                        <dl>
                            <div><dt>Korisničko ime</dt><dd>${esc(k.korisnickoIme)}</dd></div>
                            <div><dt>Lozinka</dt><dd>••••••••</dd></div>
                        </dl>
                    </section>
                </div>`}
            </section>
        </div>
    </div>`;
}

function sacuvajProfil(forma) {
    const p = podaciIzForme(forma);
    const greske = proveriProfil(p, false, korisnik.korisnickoIme);
    prikaziGreske(forma, greske);
    const broj = Object.keys(greske).length;
    document.getElementById("greskaProfila").textContent = broj ? `Proverite označena polja (${broj}).` : "";
    if (broj) return;

    ["ime", "prezime", "email", "telefon", "adresa", "grad", "postanskiBroj", "omiljeneVrste"].forEach(k => { korisnik[k] = p[k]; });
    sacuvaj("zk_korisnici", sviKorisnici().map(k => k.korisnickoIme === korisnik.korisnickoIme ? korisnik : k));
    stanje.izmenaProfila = false;
    osveziZaglavlje();
    obavesti("Podaci profila su uspešno sačuvani.", "uspeh");
    prikaziProfil();
}

function otvoriPromenuLozinke() {
    const polje = (ime, natpis) => `
        <div class="polje">
            <label for="f-${ime}">${natpis}</label>
            <input id="f-${ime}" name="${ime}" type="password" required>
            <small class="greska" id="g-${ime}"></small>
        </div>`;
    otvoriModal(`
        <div class="modal-zaglavlje">
            <h2 id="modalNaslov">Promena lozinke</h2>
            <button class="modal-zatvori" data-akcija="zatvoriModal" aria-label="Zatvori">✕</button>
        </div>
        <form data-forma="lozinka" novalidate>
            <div class="modal-telo">
                ${polje("trenutna", "Trenutna lozinka")}
                ${polje("nova", "Nova lozinka")}
                ${polje("potvrdaNove", "Potvrda nove lozinke")}
                <small class="tiho">Bar 6 znakova i bar jedna cifra.</small>
            </div>
            <div class="modal-akcije">
                <button type="button" class="dugme dugme-obrub" data-akcija="zatvoriModal">Odustani</button>
                <button class="dugme">Promeni lozinku</button>
            </div>
        </form>`);
}

function promeniLozinku(forma) {
    const p = Object.fromEntries(new FormData(forma));
    const g = {};
    if (p.trenutna !== korisnik.lozinka) g.trenutna = "Trenutna lozinka nije ispravna.";
    if (p.nova.length < 6 || !/\d/.test(p.nova)) g.nova = "Bar 6 znakova i bar jedna cifra.";
    else if (p.nova === p.trenutna) g.nova = "Nova lozinka mora biti drugačija od trenutne.";
    if (p.potvrdaNove !== p.nova) g.potvrdaNove = "Lozinke se ne poklapaju.";
    prikaziGreske(forma, g);
    if (Object.keys(g).length) return;
    korisnik.lozinka = p.nova;
    sacuvaj("zk_korisnici", sviKorisnici().map(k => k.korisnickoIme === korisnik.korisnickoIme ? korisnik : k));
    zatvoriModal();
    obavesti("Lozinka je uspešno promenjena.", "uspeh");
}

function prikaziNijePronadjeno() {
    document.title = "Stranica nije pronađena – Zeleni Kutak";
    aplikacija.innerHTML = `
    <div class="stranica">
        <div class="prazno veliko">
            <span aria-hidden="true">🥀</span>
            <h1>Stranica nije pronađena</h1>
            <p>Možda je biljka uklonjena iz ponude ili je adresa pogrešna.</p>
            <a class="dugme" href="#/biljke">Nazad na katalog</a>
        </div>
    </div>`;
}

// ---------- Dijalozi (modali) i obaveštenja ----------

let prethodniFokus = null;

function otvoriModal(html) {
    const sloj = document.getElementById("modalSloj");
    const modal = document.getElementById("modal");
    if (sloj.hidden) prethodniFokus = document.activeElement;
    modal.innerHTML = html;
    sloj.hidden = false;
    document.body.classList.add("bez-skrola");
    const prvo = modal.querySelector("input:not([type=radio]), textarea, select") || modal.querySelector(".modal-akcije .dugme:last-child");
    if (prvo) prvo.focus();
}

function zatvoriModal() {
    const sloj = document.getElementById("modalSloj");
    if (sloj.hidden) return;
    sloj.hidden = true;
    document.getElementById("modal").innerHTML = "";
    document.body.classList.remove("bez-skrola");
    if (prethodniFokus && document.contains(prethodniFokus)) prethodniFokus.focus();
}

// Korisnik sam zatvara dijalog – gost tada odustaje i od započete rezervacije
function zatvoriDijalog() {
    stanje.posleRezervisi = null;
    zatvoriModal();
}

let potvrdaPovratak = null;

function potvrdi({ naslov, poruka, dugme, odustani = "Odustani", opasno = false }, naPotvrdu) {
    potvrdaPovratak = naPotvrdu;
    otvoriModal(`
        <div class="modal-zaglavlje">
            <h2 id="modalNaslov">${naslov}</h2>
            <button class="modal-zatvori" data-akcija="zatvoriModal" aria-label="Zatvori">✕</button>
        </div>
        <div class="modal-telo"><p>${poruka}</p></div>
        <div class="modal-akcije">
            <button class="dugme dugme-obrub" data-akcija="zatvoriModal">${odustani}</button>
            <button class="dugme ${opasno ? "dugme-opasno" : ""}" data-akcija="potvrdi">${dugme}</button>
        </div>`);
}

function obavesti(poruka, tip = "info", akcija = null, naslov = "") {
    const kontejner = document.getElementById("obavestenja");
    const el = document.createElement("div");
    el.className = "obavestenje " + tip;
    el.setAttribute("role", tip === "greska" ? "alert" : "status");
    const ikonica = { uspeh: "✅", info: "ℹ️", greska: "⚠️" }[tip];
    el.innerHTML = `
        <span class="obavestenje-ikonica" aria-hidden="true">${ikonica}</span>
        <div class="obavestenje-tekst">${naslov ? `<strong class="obavestenje-naslov">${naslov}</strong>` : ""}<p>${poruka}</p></div>
        ${akcija ? `<button class="dugme dugme-malo">${akcija.tekst}</button>` : ""}
        <button class="obavestenje-zatvori" aria-label="Zatvori obaveštenje">✕</button>`;
    const ukloni = () => { el.classList.add("nestaje"); setTimeout(() => el.remove(), 250); };
    el.querySelector(".obavestenje-zatvori").addEventListener("click", ukloni);
    if (akcija) {
        el.querySelector(".dugme").addEventListener("click", () => {
            ukloni();
            if (akcija.ruta) idi(akcija.ruta);
            if (akcija.akcija) akcija.akcija();
        });
    }
    kontejner.appendChild(el);
    setTimeout(ukloni, akcija ? 8000 : 5000);
}

// ---------- Virtuelni asistent (unapred definisano stablo dijaloga) ----------

const agent = { zapocet: false };

function prebaciAgenta() {
    const panel = document.getElementById("agentPanel");
    const dugme = document.getElementById("agentDugme");
    const otvori = panel.hidden;
    panel.hidden = !otvori;
    dugme.hidden = otvori;
    dugme.setAttribute("aria-expanded", String(otvori));
    if (otvori) {
        if (!agent.zapocet) { agent.zapocet = true; agentKorak("start"); }
        setTimeout(() => { const prvo = panel.querySelector(".agent-opcije button"); if (prvo) prvo.focus(); }, 50);
    } else {
        dugme.focus();
    }
}

function dodajPoruku(ko, html) {
    const poruke = document.getElementById("agentPoruke");
    const el = document.createElement("div");
    el.className = "poruka " + ko;
    el.innerHTML = html;
    poruke.appendChild(el);
    poruke.scrollTop = poruke.scrollHeight;
    return el;
}

function agentKorak(cvorKljuc, tekstKorisnika) {
    const opcije = document.getElementById("agentOpcije");
    opcije.innerHTML = "";
    if (tekstKorisnika) dodajPoruku("korisnik", esc(tekstKorisnika));

    const kuca = dodajPoruku("agent kuca", "<span></span><span></span><span></span>");
    setTimeout(() => {
        kuca.remove();
        const cvor = DIJALOG[cvorKljuc];
        let html = typeof cvor.poruka === "function" ? cvor.poruka() : cvor.poruka;
        if (cvor.preporuka) {
            const izbor = biljke.filter(cvor.preporuka)
                .sort((a, b) => prosekOcena(b.id) - prosekOcena(a.id)).slice(0, 3);
            html += `<div class="agent-preporuke">${izbor.map(b => `
                <a href="#/biljka/${b.id}" class="agent-biljka">
                    <img src="${b.slika}" alt="">
                    <span><strong>${esc(b.name)}</strong><small>${cena(b.price)} · ${recenzijeBiljke(b.id).length ? "★ " + prosekOcena(b.id).toFixed(1).replace(".", ",") : "bez ocena"}</small></span>
                </a>`).join("")}</div>`;
        }
        dodajPoruku("agent", html);

        const lista = (typeof cvor.opcije === "function" ? cvor.opcije() : cvor.opcije).slice();
        if (cvorKljuc !== "start") lista.push(["↩ Nazad na početak", "start"]);
        opcije.innerHTML = lista.map(([tekst, cilj]) =>
            `<button data-akcija="agentOpcija" data-cilj="${esc(cilj)}">${esc(tekst)}</button>`).join("");
        const poruke = document.getElementById("agentPoruke");
        poruke.scrollTop = poruke.scrollHeight;
    }, 600);
}

function agentOpcija(dugme) {
    const cilj = dugme.dataset.cilj;
    const tekst = dugme.textContent;
    if (cilj.startsWith("#/")) {
        dodajPoruku("korisnik", esc(tekst));
        dodajPoruku("agent", "Otvaram stranicu… Tu sam ako Vam zatreba još nešto. 🌿");
        idi(cilj);
        return;
    }
    agentKorak(cilj, tekst);
}

function agentIspocetka() {
    document.getElementById("agentPoruke").innerHTML = "";
    agentKorak("start");
}

// ---------- Akcije (obrada klikova) ----------

const AKCIJE = {
    rezervisi: (el) => zapocniRezervaciju(Number(el.dataset.id)),
    kaPrijavi: (el) => {
        zatvoriModal();
        idi(el.dataset.ruta);
    },
    zatvoriModal: () => zatvoriDijalog(),
    potvrdi: () => {
        const povratak = potvrdaPovratak;
        potvrdaPovratak = null;
        zatvoriModal();
        if (povratak) povratak();
    },
    kategorija: (el) => {
        stanje.kategorija = el.dataset.kategorija;
        stanje.pretraga = null;
        stanje.prikazano = 24;
        idi("#/biljke");
    },
    kategorijaKatalog: (el) => {
        stanje.kategorija = el.dataset.kategorija;
        stanje.prikazano = 24;
        prikaziKatalog();
    },
    sortirajPoOceni: () => {
        stanje.sortiranje = "ocena";
        stanje.kategorija = "";
        stanje.pretraga = null;
        idi("#/biljke");
    },
    kriterijum: (el) => {
        stanje.kriterijum = el.dataset.kriterijum;
        osveziPanelPretrage();
        const prvo = document.querySelector(".pretraga-forma input, .pretraga-forma select");
        if (prvo) prvo.focus();
    },
    ponistiPretragu: () => {
        stanje.pretraga = null;
        stanje.prikazano = 24;
        osveziPanelPretrage();
        prikaziRezultate();
    },
    predlog: (el) => {
        document.getElementById(el.dataset.polje).value = el.dataset.vrednost;
        primeniPretragu(el.closest("form"));
        osveziPanelPretrage();
    },
    brziDatum: (el) => {
        document.getElementById("pDatumOd").value = el.dataset.od;
        document.getElementById("pDatumDo").value = el.dataset.do;
        primeniPretragu(el.closest("form"));
        osveziPanelPretrage();
    },
    brzaCena: (el) => {
        document.getElementById("pCenaOd").value = el.dataset.min;
        document.getElementById("pCenaDo").value = el.dataset.max;
        primeniPretragu(el.closest("form"));
        osveziPanelPretrage();
    },
    prikaziJos: () => {
        stanje.prikazano += 24;
        prikaziRezultate();
    },
    skrolujDo: (el) => document.getElementById(el.dataset.cilj).scrollIntoView({ behavior: "smooth" }),
    kolicina: (el) => {
        const polje = document.getElementById("rezKolicina");
        const nova = (Number(polje.value) || 0) + Number(el.dataset.smer);
        polje.value = Math.min(Number(polje.max), Math.max(1, nova));
        osveziUkupnoRezervacije();
    },
    filterKorpe: (el) => {
        stanje.filterKorpe = el.dataset.filter;
        prikaziKorpu();
    },
    izmeniStavku: (el) => {
        const { stavka } = nadjiStavku(el.dataset.id);
        otvoriFormuRezervacije(biljkaPoId(stavka.biljkaId), stavka);
    },
    otkaziStavku: (el) => otkaziStavku(el.dataset.id),
    ukloniStavku: (el) => ukloniStavku(el.dataset.id),
    simulirajDolazak: (el) => simulirajDolazak(el.dataset.id),
    oceniStavku: (el) => otvoriOcenjivanje(el.dataset.id),
    odjava: () => odjaviSe(),
    popuniDemo: () => {
        document.getElementById("prKorisnik").value = DEMO_KORISNIK.korisnickoIme;
        document.getElementById("prLozinka").value = DEMO_KORISNIK.lozinka;
    },
    prikaziLozinku: (el) => {
        const polje = document.getElementById(el.dataset.polje);
        const skriveno = polje.type === "password";
        polje.type = skriveno ? "text" : "password";
        el.textContent = skriveno ? "Sakrij" : "Prikaži";
    },
    izmeniProfil: () => { stanje.izmenaProfila = true; prikaziProfil(); },
    odustaniProfil: () => { stanje.izmenaProfila = false; prikaziProfil(); },
    promeniLozinku: () => otvoriPromenuLozinke(),
    agent: () => prebaciAgenta(),
    agentOpcija: (el) => agentOpcija(el),
    agentIspocetka: () => agentIspocetka(),
    vratiDemo: () => potvrdi({
        naslov: "Vratiti demo podatke?",
        poruka: "Svi novi nalozi, rezervacije i ocene napravljeni tokom testiranja biće obrisani, a demo nalog vraćen na početno stanje.",
        dugme: "Vrati demo podatke",
        opasno: true
    }, () => {
        pripremiDemoPodatke(true);
        korisnik = null;
        stanje.filterKorpe = "sve";
        osveziZaglavlje();
        obavesti("Demo podaci su vraćeni na početno stanje.", "info");
        idi("#/");
    })
};

const FORME = {
    brzaPretraga: (forma) => {
        const tekst = String(new FormData(forma).get("tekst") || "").trim();
        stanje.kategorija = "";
        stanje.kriterijum = "naziv";
        stanje.pretraga = tekst ? { kriterijum: "naziv", vrednosti: { tekst }, opis: `Naziv sadrži „${esc(tekst)}”` } : null;
        idi("#/biljke");
    },
    pretraga: (forma) => { if (primeniPretragu(forma)) osveziPanelPretrage(); },
    rezervacija: sacuvajRezervaciju,
    ocena: sacuvajOcenu,
    prijava: prijaviSe,
    registracija: registrujSe,
    profil: sacuvajProfil,
    lozinka: promeniLozinku
};

document.addEventListener("click", e => {
    const el = e.target.closest("[data-akcija]");
    if (el && AKCIJE[el.dataset.akcija]) {
        e.preventDefault();
        AKCIJE[el.dataset.akcija](el, e);
        return;
    }
    // Klik na zatamnjenu pozadinu zatvara dijalog
    if (e.target.id === "modalSloj") zatvoriDijalog();
});

document.addEventListener("submit", e => {
    const forma = e.target.closest("form[data-forma]");
    if (!forma) return;
    e.preventDefault();
    FORME[forma.dataset.forma](forma);
});

document.addEventListener("change", e => {
    if (e.target.dataset.promena === "sortiranje") {
        stanje.sortiranje = e.target.value;
        prikaziRezultate();
    }
    if (e.target.name === "ocena" && e.target.closest(".zvezde-unos")) {
        document.getElementById("ocenaOpis").textContent = OPISI_OCENA[e.target.value];
    }
});

let tajmerPretrage = null;
document.addEventListener("input", e => {
    if (e.target.id === "rezKolicina") osveziUkupnoRezervacije();

    // Pretraga po nazivu radi i dok korisnik kuca
    if (e.target.hasAttribute("data-uzivo")) {
        clearTimeout(tajmerPretrage);
        const forma = e.target.closest("form");
        tajmerPretrage = setTimeout(() => {
            if (e.target.value.trim()) primeniPretragu(forma);
            else { stanje.pretraga = null; prikaziRezultate(); }
        }, 250);
    }

    // Greška polja nestaje čim korisnik počne da je ispravlja
    if (e.target.getAttribute("aria-invalid")) {
        e.target.removeAttribute("aria-invalid");
        const greska = document.getElementById("g-" + e.target.name);
        if (greska) greska.textContent = "";
    }
});

document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!document.getElementById("modalSloj").hidden) zatvoriDijalog();
    else if (!document.getElementById("agentPanel").hidden) prebaciAgenta();
});

window.addEventListener("hashchange", ruter);

// ---------- Pokretanje ----------

async function pokreni() {
    const podaci = await ucitajBiljke();
    biljke = podaci.map(pripremiBiljku);
    biljke.forEach(b => { generisaneRecenzije[b.id] = generisiRecenzije(b); });

    pripremiDemoPodatke(false);
    const sesija = ucitaj("zk_sesija", null);
    korisnik = sviKorisnici().find(k => k.korisnickoIme === sesija) || null;

    document.getElementById("izvorPodataka").textContent = izvorPodataka === "api"
        ? "Podaci o biljkama: plants.pequla.com API (uživo)"
        : "Podaci o biljkama: lokalna kopija plants.pequla.com API-ja";

    osveziZaglavlje();
    ruter();
    window.zkSpremno = true;
    document.dispatchEvent(new Event("zk-spremno"));
}

pokreni();
