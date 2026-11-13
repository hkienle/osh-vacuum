# HMI PCB (Hardware V2)

Breakaway panel with the user interface boards: two LED strips and the button boards. The boards are snapped out of
the panel and screwed into the housing. KiCad 10 project `Abbrech_V2.kicad_pro`, schematic as PDF in
[Abbrech_V2.pdf](Abbrech_V2.pdf).

**Status:** first batch ordered at JLCPCB in November 2026, not yet tested.

## Panel

One panel (70 × 81.2 mm, 2 layers, 1.6 mm) holds one set of boards, all 15.3 mm wide:

| Row | Boards |
|---|---|
| 1 | LED strip A, 56 mm: 10 × WS2812B-2020 |
| 2 | LED strip B, 56 mm: 5 × WS2812B-5050 (7.8 mm pitch) |
| 3 | Single button T1 (17.33 mm) · double button T5/T6 (32.5 mm, button centres 15.00 mm apart, two connectors) |
| 4 | Single buttons T2 · T3 · T4 |

- 5 mm frame with three fiducials, 2 mm milled slots between the boards, 5 mm tabs with mouse bites.
- The boards are not wired to each other; every board (and each button of the double board) has its own nets.
- Each end has a half hole Ø 3.0 mm for an M3 screw; no parts within 3 mm of it (screw head Ø 6 mm).

## Boards

- **LED strips:** data runs from `IN` (right) to `OUT` (left), so strips can be chained. 100 nF per LED, 10 µF at the
  input, 5 V and GND fed from both connectors.
- **Buttons:** TS-1187A-C-A-B (5.1 × 5.1 mm, 2.6 N), centred on the board.
- **Connectors (bottom side, not assembled):** each connection has a JST PH SMD footprint (horizontal) and a JST PH THT
  footprint (vertical). Solder the one that fits the housing.

Pinout 1:1 with the [Main PCB](../Main%20PCB/README.md), so use straight JST PH cables (pin 1 to pin 1):

| Board | Pin 1 | Pin 2 | Pin 3 | Silkscreen |
|---|---|---|---|---|
| LED strip | GND | Data | 5 V | `G D +` |
| Button | Switch | GND | – | `S G` |

## Files

| Path | Content |
|---|---|
| `Abbrech_V2.kicad_pro`, `.kicad_sch`, `.kicad_pcb` | KiCad 10 project |
| `Abbrech_V2.pretty/` | Project footprint (mouse bite tab) |
| `3d/` | 3D models from the JLCEDA/EasyEDA library (WS2812B-2020, TS-1187A, JST PH SMD), source in `3d/QUELLE.md` |
| `step/` | STEP models of the single boards after breaking out (LED 2020, LED 5050, single and double button), without unassembled parts |
| `Production/` | JLCPCB data: Gerber ZIP (plus unpacked `gerber/`), BOM, CPL |

## Ordering at JLCPCB

Upload `Production/Abbrech_V2_gerber.zip`, then BOM and CPL for assembly.

- 2 layers, 1.6 mm, 1 oz, vias tented
- Delivery format "Panel by Customer", "Different Design": 4
- PCBA top side only (the bottom side has only the unassembled connectors), edge rails/fiducials added by JLCPCB
- "Bake Components": yes, for both WS2812B types (moisture sensitive)
- In the placement preview, check the orientation of every LED: one rotated LED breaks the whole chain.

The top frame carries `COMMIT xxxxxxx`, see [Hardware V2](../README.md#commit-marking).
