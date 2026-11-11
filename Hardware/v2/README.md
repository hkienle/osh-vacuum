# Hardware V2

KiCad 10 projects of the V2 electronics (November 2026).

| Folder | Content |
|---|---|
| `OSH_Vacuum_V2/` | Main board (4 layers, ESP32-S3), schematic PDF `OSH_Vacuum_V2.pdf` |
| `Abbrech_V2/` | Breakaway panel: LED strips (10 × WS2812B-2020, 5 × WS2812B-5050) and button boards, schematic PDF, STEP models of the single boards in `step/` |
| `Fertigung/OSH_Vacuum_V2_JLC/` | JLCPCB data for the main board: Gerber ZIP, BOM, CPL |
| `Fertigung/Abbrech_V2_JLC/` | JLCPCB data for the breakaway panel (panel by customer, mouse bites): Gerber ZIP, BOM, CPL |

Cable pinout is 1:1 between main board and breakaway boards (JST PH): LED 1 GND, 2 data, 3 5V; button 1 switch, 2 GND.
Use straight (pin 1 to pin 1) JST PH cables – a reversed cable swaps 5V and GND on the LED strips.

3D models from the JLCEDA/EasyEDA Official Library are included in the project folders (`OSH_Vacuum_V2.3dshapes/`,
`Abbrech_V2/3d/`, source see `Abbrech_V2/3d/QUELLE.md`).
