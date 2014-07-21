REM IF %1.==. GOTO No1
REM IF %2.==. GOTO No2

REM xcopy /e . %1
REM cd %1

set UGLIFY_ARGS=--screw-ie8 --compress drop_console,warnings

cs js
uglifyjs highlight_definitions.js %UGLIFY_ARGS% -o highlight_definitions.min.js
uglifyjs string_utils.js %UGLIFY_ARGS% -o string_utils.min.js
uglifyjs stylesheet.js %UGLIFY_ARGS% -o stylesheet.min.js

cd background
uglifyjs context_menus.js %UGLIFY_ARGS% -o context_menus.min.js
uglifyjs database.js %UGLIFY_ARGS% -o database.min.js
uglifyjs event_page.js %UGLIFY_ARGS% -o event_page.min.js
uglifyjs tabs.js %UGLIFY_ARGS% -o tabs.min.js

cd ..\content_script
uglifyjs content_script.js %UGLIFY_ARGS% -o content_script.min.js
uglifyjs highlighter.js %UGLIFY_ARGS% -o highlighter.min.js
uglifyjs xpath.js %UGLIFY_ARGS% -o xpath.min.js

cd ..\options
uglifyjs app.js %UGLIFY_ARGS% -o app.min.js
uglifyjs controllers.js %UGLIFY_ARGS% -o controllers.min.js

cd ..\popup
uglifyjs app.js %UGLIFY_ARGS% -o app.min.js
uglifyjs controllers.js %UGLIFY_ARGS% -o controllers.min.js

GOTO End1

:No1
  ECHO No param 1
GOTO End1

REM :No2
REM   ECHO No param 2
REM GOTO End1

:End1