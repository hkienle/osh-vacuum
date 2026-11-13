# Main PCB (Hardware V2)

Control board of the vacuum cleaner: battery input, motor and brush switching, ESP32-S3, sensors and all connectors.
KiCad 10 project `OSH_Vacuum_V2.kicad_pro`, schematic as PDF in [OSH_Vacuum_V2.pdf](OSH_Vacuum_V2.pdf).

**Status:** first batch ordered at JLCPCB in November 2026, not yet tested.

## Board

- 68 × 90 mm, 4 layers, 1.6 mm, 2 oz outer / 1 oz inner copper
- All parts on the top side, all parts in stock at JLCPCB (LCSC number in every symbol)
- Four M3 mounting holes (plated, connected to GND)

## Blocks

| Schematic sheet | Content |
|---|---|
| `Versorgung.kicad_sch` (power) | XT60 battery input (J10), 25 A fuse, TVS, 1 mΩ shunt with INA237 (current and battery voltage), LMR36520 buck to 5 V, USB/5 V diode OR, LDL1117 3.3 V, AP2553 switched outputs |
| `MCU_USB.kicad_sch` | ESP32-S3-WROOM-1-N16R8, USB-C with ESD protection, reset and boot buttons |
| `Motor_Buerste.kicad_sch` (motor and brush) | High-side motor switch (LM74502 + MOSFET, soft start) to the motor XT60 (J20) for an ESC, brush output with P-MOSFET and freewheel diodes (terminal J22), status LEDs |
| `Motorsignale_I2C_NTC.kicad_sch` | Motor signal connector J61 (JST PH 5-pin): signal level V_MOT 3.3 V by default, 5 V selectable with JP60; level shifters and protected inputs. I2C bus with 4 × Qwiic/STEMMA QT, NTC input |
| `Bedienung_CAN_EXP.kicad_sch` (user interface, expansion) | WS2812B LED output J60, three buttons (on board and via JST PH J50–J52), expansion header 2 × 7 (J40) |

## Connectors to the HMI PCB

JST PH 2.0 mm, pinout 1:1 with the [HMI PCB](../HMI%20PCB/README.md), so use straight cables (pin 1 to pin 1):

| Connector | Pin 1 | Pin 2 | Pin 3 |
|---|---|---|---|
| LED (J60) | GND | Data | 5 V |
| Button (J50–J52) | Switch | GND | – |

A reversed cable swaps 5 V and GND on the LED strips.

## Files

| Path | Content |
|---|---|
| `OSH_Vacuum_V2.kicad_pro`, `*.kicad_sch`, `OSH_Vacuum_V2.kicad_pcb` | KiCad 10 project |
| `OSH_Bedien/Motor/Power.kicad_sym`, `OSH_Vacuum_V2.pretty/` | Project symbols and footprints (linked via `${KIPRJMOD}`) |
| `OSH_Vacuum_V2.3dshapes/` | 3D models that KiCad does not ship (JLCEDA/EasyEDA library or simplified approximations) |
| `Production/` | JLCPCB data: Gerber ZIP (plus unpacked `gerber/`), BOM, CPL |

## Ordering at JLCPCB

Upload `Production/OSH_Vacuum_V2_gerber.zip`, then BOM and CPL for assembly.

- 4 layers, 1.6 mm, 2 oz outer / 1 oz inner, vias plugged, min. via 0.3 / (0.4/0.45) mm
- PCBA top side, parts selected by customer, "Confirm Parts Placement": yes
- In the placement preview, check the orientation of all diodes, ICs and connectors before confirming.

The bottom silkscreen carries `COMMIT xxxxxxx`, see [Hardware V2](../README.md#commit-marking).

## Known issues

- **Boards marked `COMMIT 04D906B`:** on the bottom silkscreen, `+` and `−` are swapped at both XT60 connectors
  (BATTERY IN and MAIN (15A)). The upper pin (square pad) is **GND**, the lower pin is **+**. Only the print is wrong;
  copper and connectors are correct. Fixed in `31ACDF0`.
