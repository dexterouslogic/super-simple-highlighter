rm *.min.js;

for f in *.js; do
	short=${f%.js};
	
	uglifyjs "$f" --screw-ie8 --compress drop_console,warnings > $short.min.js; 
done