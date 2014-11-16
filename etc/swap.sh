for f in *.min.js; do
	short=${f%.min.js};
	
	mv $short.min.js $short.js;
done