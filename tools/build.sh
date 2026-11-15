set -e
OUT=/tmp/claude-0/-home-user/1a225017-3aeb-5401-8363-1982d1300b6d/scratchpad/drillbook.html
{ cat src/shell.html; echo '<script>'; for f in lines parser human_data body moves moves_lib coach3d coach reader smart app; do sed '/^if (typeof module/d' src/$f.js; echo; done; echo '</script>'; } > $OUT
wc -c $OUT
