import sys
import os
import FreeCAD
import Import
import Mesh

def convert(input_file, output_file):
    """
    Converts a STEP file to STL using FreeCAD modules.
    """
    doc = FreeCAD.newDocument("Temp")
    try:
        Import.insert(input_file, doc.Name)
        objs = doc.Objects
        Mesh.export(objs, output_file)
    finally:
        FreeCAD.closeDocument(doc.Name)

# FreeCADCmd behavior: 
# It often executes the script in a way where __name__ is the filename rather than "__main__".
# We use environment variables for reliable path passing across different FreeCAD versions.

input_step = os.environ.get("INPUT_STEP")
output_stl = os.environ.get("OUTPUT_STL")

if input_step and output_stl:
    try:
        convert(input_step, output_stl)
        print(f"Successfully converted {input_step} to {output_stl}")
    except Exception as e:
        print(f"Error converting {input_step}: {e}")
        sys.exit(1)
    # Force exit to prevent FreeCADCmd from hanging or processing further internal arguments
    os._exit(0)
else:
    print("\nFreeCAD STEP to STL Conversion Script")
    print("-" * 36)
    print("Usage via FreeCADCmd:")
    print("  INPUT_STEP=file.step OUTPUT_STL=file.stl FreeCADCmd convert_step_to_stl.py")
    print("\nUsage with 'find' for batch conversion:")
    print("  find . -name \"*.step\" -exec bash -c 'input=\"$1\"; output=\"${input%.step}.stl\"; \\")
    print("  INPUT_STEP=\"$input\" OUTPUT_STL=\"$output\" FreeCADCmd convert_step_to_stl.py' _ {} \\;")
    sys.exit(1)
