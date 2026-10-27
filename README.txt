ZELENI KUTAK – prototip korisničkog interfejsa digitalne prodavnice biljaka
Student: Maša Milosavljević - 2022202068 RN 

SADRŽAJ
  zeleni-kutak/          interaktivni prototip (programski kod)
    index.html           stranica aplikacije – otvoriti u pregledaču
    style.css            izgled
    app.js               interaktivnost (navigacija, pretraga, rezervacija, korpa, profil, asistent)
    podaci.js            simulirani podaci (recenzije, demo korisnik, stablo dijaloga asistenta)
    data/                lokalna kopija podataka sa API-ja plants.pequla.com
    images/              ilustracije biljaka
  Dokumentacija.pdf      kopije izgleda stranica sa opisom funkcija

POKRETANJE
  Dvoklik na zeleni-kutak/index.html (Chrome, Edge ili Firefox). Instalacija nije potrebna.
  Sa internetom se biljke učitavaju uživo sa https://plants.pequla.com/api/plants,
  a bez interneta se koristi lokalna kopija istih podataka.

DEMO NALOG
  korisničko ime: jelena
  lozinka:        biljke123
  (može se napraviti i novi nalog kroz registraciju)

NAPOMENE
  - Podaci (nalozi, korpe, ocene) čuvaju se lokalno u pregledaču (localStorage).
  - Dugme „Vrati demo podatke” u podnožju vraća prototip na početno stanje.
  - Dugme „Simuliraj pristizanje” u korpi služi samo za demonstraciju promene statusa
    (u stvarnoj aplikaciji status menja prodavnica).
