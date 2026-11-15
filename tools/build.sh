set -e
# Builds a single self-contained page (drillbook.html) for use as a Claude Artifact.
# Run from the repository root:  bash tools/build.sh
OUT=${OUT:-drillbook.html}
{ cat src/shell.html; echo '<script>'; for f in lines parser human_data body moves moves_lib coach3d coach reader smart app; do sed '/^if (typeof module/d' src/$f.js; echo; done; echo '</script>'; } > $OUT
wc -c $OUT
