# Herkunft der 3D-Modelle

Quelle: **JLCEDA/EasyEDA Official Library** – https://lceda.cn/ · https://easyeda.com
(Lizenzhinweis der Bibliothek: Quelle deutlich nennen, beide Links angeben, Herkunftsangaben nicht entfernen.)

| Datei | EasyEDA-Modell | Teil |
|---|---|---|
| `LED-SMD_4P-L2.0-W2.0-H0.8-TL_WS2812B-2020.step` | UUID caa88715b11f4aa189b02e52bbb84e4f (Bauteil LCSC C965555, WS2812B-2020) | Für WS2812B-2020-V6 (C52917434) verwendet: EasyEDA hat für die V6 kein Modell, das Gehäuse ist dasselbe 2020-PLCC4 |
| `SW-SMD_4P-L5.1-W5.1-P3.70-LS6.5-TL_H1.5.step` | UUID 91b67c1735f643ffb2e7226c23dd3492 (LCSC C480267, TS-1187A-C-A-B) | Taster TS-1187A-C-A-B |
| `CONN-SMD_PH2.00-WS-3P_S3B-PH-SM4-TB.step` | UUID 5cd8c3a4ea954c56a35bebd156a3dd64 (LCSC C265101, S3B-PH-SM4-TB) | PH-Stecker 3-polig (LED), unten, nicht bestückt |
| `CONN-SMD_P2.00_S2B-PH-SM4-TB-LF-SN.step` | UUID e009435048914ef2b30a218c3065ed28 (LCSC C295747, S2B-PH-SM4-TB) | PH-Stecker 2-polig (Taster), unten, nicht bestückt |

Geladen am 2026-11-11 über die EasyEDA-Bauteilschnittstelle (ohne Anmeldung), Anlass: KiCad 10 liefert die in den
Footprints LED_WS2812B-2020_PLCC4_2.0x2.0mm, SW_Push_1P1T_XKB_TS-1187A und JST_PH_SnB-PH-SM4-TB angegebenen
STEP-Dateien nicht mit. Die PH-Modelle sind in gen_pcb.py um die Mitte ihres Hüllquaders verschoben (EasyEDA richtet
Modelle so aus): 3-polig (+2,0 / −2,98 mm), 2-polig (+1,0 / −3,03 mm), ohne Drehung.
Nur für die 3D-Ansicht und Renderbilder; die Fertigungsdaten enthalten sie nicht.
