shopt -s globstar
for f in js/*.js; do
	short=${f%.js};
	
	rm $short.min.js;
	uglifyjs "$f" --screw-ie8 --compress drop_console,warnings > $short.min.js; 
done