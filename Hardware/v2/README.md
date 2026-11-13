# Hardware V2

KiCad 10 projects of the V2 electronics (November 2026). First batch ordered at JLCPCB, not yet tested.

| Folder | Board |
|---|---|
| [Main PCB](Main%20PCB/README.md) | Control board: battery input, motor and brush switching, ESP32-S3, sensors, connectors (4 layers, 68 × 90 mm) |
| [HMI PCB](HMI%20PCB/README.md) | Breakaway panel with the user interface: LED strips (WS2812B-2020 and -5050) and button boards (2 layers) |

Each folder contains the KiCad project, the schematic as PDF and the JLCPCB manufacturing data in `Production/`
(Gerber ZIP, BOM, CPL).

The two boards are connected with JST PH 2.0 mm cables, pinout 1:1 (pin 1 to pin 1): LED 1 GND, 2 data, 3 5V;
button 1 switch, 2 GND. A reversed cable swaps 5 V and GND on the LED strips.

## Commit marking

Both boards carry `COMMIT xxxxxxx` in the silkscreen: the short hash of the commit in this repository that contains the
board files the Gerbers were made from. To see the exact design of a board in your hand, open
`https://github.com/hkienle/osh-vacuum/tree/<hash>` or run `git checkout <hash>`.

The first batch carries `COMMIT 04D906B`. At that commit the projects were still in `Hardware/v2/OSH_Vacuum_V2/`
(Main PCB) and `Hardware/v2/Abbrech_V2/` (HMI PCB); the files themselves are unchanged.
