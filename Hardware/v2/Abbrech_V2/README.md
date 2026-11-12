# Abbrechplatine V2 – LED-Streifen und Taster

Stand 2026-11-11 (Rev B, Mouse Bites). Ein Nutzen 70 × 81,2 mm mit einem Satz Zubehör-Platinen. Die Teilplatinen und die
Taster sind nicht untereinander verdrahtet: jede/jeder hat eigene Netze, auch die beiden Taster der Doppeltaster-Platine.

| Reihe | Teilplatinen (je 15,3 mm breit) |
|---|---|
| 0 | LED A 56 mm: 10 × WS2812B-2020 (V6, C52917434) |
| 1 | LED B 56 mm: 5 × WS2812B-5050 (V6, C52917433), Raster 7,8 mm wie V1, Pads quer |
| 2 | Einzeltaster T1 (17,3 mm) · Doppeltaster T5/T6 (32,5 mm, zwei Stecker) |
| 3 | Einzeltaster T2 · T3 · T4 |

Ringsum 5 mm Rand mit drei Passermarken, zwischen den Platinen 2 mm Fräsnut, Stege 5 mm mit Mouse Bites.

## Entscheidungen (Thomas)
- 2026-11-10: Breite 15,3 mm wie V1; Taster mit Bohrung an einem Ende und Halbbohrung am anderen; Taster TS-1187A-C-A-B
  (Extended, 2,6 N statt 1,6 N beim Basic-Teil, Hub bei Taktschaltern immer ≈ 0,25 mm); Stecker nicht bestückt, JLC bestückt
  nur die Oberseite; Bestellung bei JLC.
- 2026-11-10: LEDs exakt mittig.
- 2026-11-11: 5050-Streifen mit 5 LEDs, Pads quer zum Streifen.
- 2026-11-11 (später): keine THT-Löcher; alle Schraublöcher nur als Halbbohrung an den Enden (LED und Taster);
  Taster auf der Doppeltaster-Platine weiter auseinander (wie zwei Einzeltaster am Stück).
- 2026-11-11 (später): Stege auch zwischen den Taster-Reihen; je Kante ein Steg am Einzeltaster, zwei am Doppeltaster;
  alle Taster um 90° gedreht (Pads längs).
- 2026-11-11 (später): LED-Streifen zusätzlich mit THT-PH, um 90° gedreht neben den LEDs (u 7 / 49); SMD-PH nach innen; Doppeltaster ebenfalls mit THT-PH.
- 2026-11-11 (später): Einzeltaster zusätzlich mit THT-PH (B2B-PH-K, stehend, bestückt, Unterseite, bündig mit
  der Kante) dort, wo vorher die Beschriftung stand; der SMD-PH bleibt als Footprint, DNP; alle Taster-Platinen gleich
  ausgerichtet. (Kurz danach geändert: alle Stecker der Unterseite DNP, auch die THT-PH, siehe unten.)
- 2026-11-12 (später): Doppeltaster-Platine 32,5 mm statt 36,67 mm lang, an beiden Enden je 2,08 mm kürzer; Taster,
  Stecker, Leiterbahnen und Stege bleiben exakt an ihrem Platz.
- 2026-11-12 (später): Stege 5 mm statt 3 mm breit (JLC verlangt mind. 5 mm), je Seite 6 statt 4 Mouse-Bite-Bohrungen;
  Lage der Stege unverändert.
- 2026-11-12: Doppeltaster näher zusammen: Tastermitten 15,00 mm (vorher 19,33 mm); Stege an der Steckerseite und
  Siebdruck unten (Figma, Beschriftung der Doppeltaster mitgerückt) angepasst.
- 2026-11-11 (Umbau Rev B): alle Ecken so groß wie sinnvoll gerundet; Platinen mit Mouse Bites verbinden (V1 brach viel zu
  schwer, V-Cut erlaubt keine runden Ecken); LED-Streifen genau 56 mm; SMD- und THT-Stecker getrennt (SMD unten unter den
  LEDs, THT neben dem Schraubloch zur Kante versetzt); Taster kürzer (Schraubenkopf Ø 6 mm); eine Reihe Einzeltaster und
  eine Doppeltaster-Platine mit zwei Steckern („zwei Einzeltaster am Stück“); ein Satz je Nutzen; 4 Einzeltaster; Taster
  untereinander nicht verdrahtet. Vorbild: Abbrechteil der V1 („so in der Art grob“).

## Umsetzung
- **Maße**: Breite 15,3 mm, LED-Streifen 56 mm (V1), Eckradius 5 mm. An jedem Ende mittig eine Halbbohrung Ø 3,0 mm.
  Einzeltaster 17,33 mm (drei Stück plus zwei Nuten = 56 mm), Eckradius 4,5 mm (sonst lägen die Haltelaschen des
  SMD-Steckers in der Ecke), Taster mittig mit Pads längs. Doppeltaster 32,5 mm lang (seit 2026-11-12; vorher 36,67 mm wie zwei Einzeltaster am Stück), mittig im alten Feld,
  Tastermitten 15,00 mm auseinander (je 8,75 mm vom Ende), GND-Fläche in der Mitte geteilt.
- **Schraubenkopf Ø 6 mm**: oben im Umkreis 3 mm um jede Halbbohrung keine Bauteile und keine Lötstellen.
- **Pinbelegung 1:1 wie Hauptplatine** (gerade PH-Kabel): LED 1 GND, 2 Daten, 3 5V (J60); Taster 1 Schalter, 2 GND
  (J50–J52). Beschriftung unten je Pin `G D +` bzw. `S G`, dazu `IN`/`OUT` oben und unten.
- **Taster T1–T6**: zusätzlich JST PH THT stehend (B2B-PH-K-S, C131337, nicht bestückt) auf der
  Unterseite, Gehäuse endet bündig mit der Kante (Lochreihe 2,85 mm von der Kante). Alle Taster-Platinen liegen gleich im
  Nutzen (Stecköffnung des SMD-PH oben).
- **LED-Streifen**: an beiden Enden zusätzlich JST PH THT stehend (B3B-PH-K-S, C131339, nicht bestückt, Unterseite), um 90°
  gedreht (Lochreihe quer bei u 7 / 49, neben den LEDs); die SMD-PH (DNP) sitzen weiter
  innen bei u 20 / 36.
- **Stecker**: je Anschluss ein JST PH SMD liegend (S3B/S2B-PH-SM4-TB, nicht bestückt) auf der Unterseite unter den LEDs
  bzw. unter dem Taster, Öffnung bündig zur Längskante (0,65 mm zurück). Keine THT-Löcher.
- **LED-Streifen**: LEDs mittig, Datenkette von IN (rechts) nach OUT (links), 100 nF je LED, 10 µF am Eingang,
  5V-Schiene oben 0,8 mm, Einspeisung von beiden Steckern, GND-Flächen oben und unten.
  5050: VDD/DO oben, GND/DI unten, Daten mit 45° durch die Lücken, 100 nF senkrecht in der Lücke auf der Eingangsseite
  jeder LED. 2020: 100 nF längs über der LED, Pad 1 genau über dem VDD-Pad. 10 µF senkrecht zwischen THT-Stecker (Ausgang)
  und der ersten LED, Pad 1 auf der Schiene (Thomas 2026-11-11: weg vom Rand, kompakter).
- **Nutzen**: Fräsnut 2 mm, Stege 5 mm (Footprint `Abbrech_V2:MouseBites_Steg5mm_Nut2mm`: je Seite 6 NPTH Ø 0,5 mm im
  Raster 0,8 mm, Mitte 0,25 mm in der Platine, so bricht der Steg an der Platinenkante). Stege nur an den Längskanten (die
  Stirnseiten haben Halbbohrungen). LED-Streifen: drei Stege je Längskante zwischen den Stecköffnungen. Taster: je Kante
  ein Steg mittig unter dem Taster (Doppeltaster zwei); an der Steckerseite sitzt er mittig vor dem Stecker zwischen den
  Haltelaschen – der Stecker ist unten, das Gegenstück wird unter der Platine eingeschoben, ein Steg-Rest stört nicht.
  Die Sperrfläche des SMD-PH ragt dabei über die Kante (Gehäuse endet 0,15 mm vor den Bohrungen); deshalb ist die
  DRC-Prüfung „NPTH in Sperrfläche“ auf „ignorieren“ gestellt. Innenecken der Stege R 0,5 mm.
- **Siebdruck der LEDs**: Umrisse aller LEDs auf F.Fab (die Abblock-Kondensatoren sitzen dicht daneben); deshalb ist die DRC-Prüfung „Footprint weicht von Bibliothek ab“ auf „ignorieren“ gestellt.
- **3D-Modelle** für WS2812B-2020, TS-1187A und die PH-SMD-Stecker aus der JLCEDA/EasyEDA Official Library
  (https://lceda.cn/, https://easyeda.com), KiCad 10 liefert sie nicht mit; Herkunft in `3d/QUELLE.md`. Renders in
  `Review/abbrech/`.

- **Siebdruck oben und unten aus Figma** (2026-11-11): Rahmen „Abbrechplatine oben – Siebdruck“ und „Abbrechplatine
  unten – Siebdruck (Ansicht von unten)“ auf der Seite „Platine“ (Figma-Datei der Hauptplatine). Render schwarz, 20 px/mm,
  deckt genau den Nutzen ab; Ebene „Siebdruck (weiß = Druck)“. Export als SVG ohne Render nach
  `tools/abbrech/assets/silk_oben.svg` / `silk_unten.svg`, `gen_pcb.py` setzt sie als Flächen (unten gespiegelt) und lässt
  die generierten Texte weg. Schrift Jost Black (Netto Pro ist über die Figma-Schnittstelle nicht ladbar; in Figma
  umstellbar, dann neu exportieren).
- **STEP-Modelle** der herausgebrochenen Teilplatinen (ohne DNP-Teile): `step/Abbrech_LED_2020.step`,
  `Abbrech_LED_5050.step`, `Abbrech_Taster_einzeln.step`, `Abbrech_Taster_doppelt.step`, erzeugt mit
  `tools/abbrech/export_step.py` (KiCad-Python, aus 05_Hardware).

## Erzeugen und Prüfen
Alles wird aus Skripten erzeugt (nicht in KiCad von Hand ändern, sonst überschreibt der nächste Lauf die Änderung):

```
zsh tools/abbrech/build.sh                                   # Schaltplan, Layout, Flächen füllen, ERC + DRC mit Schaltplan-Abgleich
zsh tools/abbrech/fertigung.sh Fertigung/Abbrech_aktuell     # JLC: Gerber-ZIP, BOM, CPL (zu jedem Commit neu)
```
(beides aus `05_Hardware`). Stand 2026-11-11: ERC 0, DRC 0, Abgleich 0.

## Bestellung bei JLC
- 2 Lagen, 1,6 mm, 1 oz, Farbe wie Hauptplatine; „Panel by Customer“ (Nutzen mit Fräsnuten und Mouse Bites, keine
  V-Cuts); Vias „Tented“.
- „Different Design“: 4 (LED 2020, LED 5050, Einzeltaster, Doppeltaster).
- PCBA: nur Oberseite (Top Side), 5 BOM-Positionen (beide LEDs, 100 nF, 10 µF, Taster), davon 3 Extended.
  Die Unterseite ist komplett DNP (alle JST-Stecker, SMD und THT; Thomas 2026-11-11), keine THT-Bestückung.
- In der Bestückungsvorschau Drehung von LEDs und Tastern prüfen (Magenta-Punkt = Pin 1): eine verdrehte LED legt die
  ganze Kette lahm.
