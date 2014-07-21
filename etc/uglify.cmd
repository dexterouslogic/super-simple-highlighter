ECHO OFF
IF %1.==. GOTO No1

uglifyjs %1 --screw-ie8 --compress drop_console,warnings -o %1.min

:No1
  ECHO No param 1
GOTO End1

:End1