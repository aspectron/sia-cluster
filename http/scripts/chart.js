
function pieChart(holder, data, height){
	var $holder = d3.select(holder);
	var width = $holder.node().clientWidth;
	height = height || 450;
	var radius = Math.min(width, height) / 2.5;
	$holder.style('height', height+"px")
	

	var svgRoot = d3.select(holder)
	.append("svg")
	.attr("width", width)
	.attr("height", height)
	.call(glow("shadow").rgb("#555"))

	var svg = svgRoot.append("g");

	svg.append("g").attr("class", "slices");
	svg.append("g").attr("class", "labels");
	svg.append("g").attr("class", "lines");


	var pie = d3.layout.pie()
	.sort(null)
	.value(function(d) {
		return d.value;
	});

	var arc = d3.svg.arc()
	.outerRadius(radius * 0.8)
	.innerRadius(radius * 0);

	var outerArc = d3.svg.arc()
	.outerRadius(radius * 0.9)
	.innerRadius(radius * 0.9)

	svg.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

	var key = function(d){ return d.data.label; };
	
	var color = d3.scale.ordinal()
	//.domain(["Lorem ipsum", "dolor sit", "amet", "consectetur", "adipisicing", "elit", "sed", "do", "eiusmod", "tempor", "incididunt"])
	.range(["#7bee88", "#98abc5", "#98ab05", "#8a89a6", "#7b6888", "#EEE", "#DDD", "#6b486b", "#a05d56", "#d0743c", "#3DC1FB", "#B4E9FE", "#ff8c00"]);

	function updateLabels(){
		var total = 0;
		data.map(function(v){
			total += v.value;
		});
		return data.map(function(v){
			var s = parseFloat(v.value * 100 / total).toFixed(0);
			return { label: v.text + " ("+s+"%)", value: v.value }
		});
	}

	change(updateLabels());


	function change(data) {

		/* ------- PIE SLICES -------*/
		var slice = svg.select(".slices").selectAll("path.slice")
		.data(pie(data), key);

		slice.enter()
		.insert("path")
		.attr("d", arc)
		.style("fill", function(d) { return color(d.data.label); })
		.attr("class", "slice");

		slice		
		.transition().duration(0)
		.attrTween("d", function(d) {
			this._current = this._current || d;
			var interpolate = d3.interpolate(this._current, d);
			this._current = interpolate(0);
			return function(t) {
				return arc(interpolate(t));
			};
		})

		slice.exit()
		.remove();

		/* ------- TEXT LABELS -------*/

		var text = svg.select(".labels").selectAll("g")
		.data(pie(data), key);

		var g = text.enter()
		.append("g");


		g.append("rect")
		.attr("width", "90")
		.attr("height", "24")
		.attr("stroke", "#111")
		.attr("stroke-width", "1")
		.attr("fill", "#FFF")
		.style("filter", "url(#shadow)")

		g.append("text")
		.attr("dy", ".35em")
		.text(function(d) {
			return d.data.label;
		});



		function midAngle(d){
			return d.startAngle + (d.endAngle - d.startAngle)/2;
		}

		text.transition().duration(0)
		.attrTween("transform", function(d, a) {
			this._current = this._current || d;
			var interpolate = d3.interpolate(this._current, d);
			this._current = interpolate(0);
			var me = this;

			return function(t) {
				var rect = d3.select(me).select('rect');
				var text = d3.select(me).select('text');
				var d2 = interpolate(t);
				var pos = outerArc.centroid(d2);
				var cc = (midAngle(d2) < Math.PI ? 1 : -1);
				pos[0] = radius * cc;
				if (text.node() && rect.node()) {
					console.dir(text.node())
					var textWidth = text.style("width").replace("px", "");
					textWidth = parseFloat(textWidth);
					var pos2 = [ ];
					if (cc < 0) {
						pos2[0] = - textWidth - 8; 
					}else{
						pos2[0] = -8;
					}

					pos2[1] = -12;
					rect.attr("transform", "translate("+ pos2 +")");
					rect.attr("width",  textWidth + 16);
				}
				return "translate("+ pos +")";
			};
		})
		.styleTween("text-anchor", function(d){
			this._current = this._current || d;
			var interpolate = d3.interpolate(this._current, d);
			this._current = interpolate(0);
			return function(t) {
				var d2 = interpolate(t);
				return midAngle(d2) < Math.PI ? "start":"end";
			};
		});

		text.exit()
		.remove();


		var polyline = svg.select(".lines").selectAll("polyline")
		.data(pie(data), key);

		polyline.enter()
		.append("polyline");

		polyline.transition().duration(1000)
		.attrTween("points", function(d){
			this._current = this._current || d;
			var interpolate = d3.interpolate(this._current, d);
			this._current = interpolate(0);
			return function(t) {
				var d2 = interpolate(t);
				var pos = outerArc.centroid(d2);
				pos[0] = radius * 0.95 * (midAngle(d2) < Math.PI ? 1 : -1);
				return [arc.centroid(d2), outerArc.centroid(d2), pos];
			};			
		});

		polyline.exit()
		.remove();
	};
}

function glow(url) {
	var stdDeviation = 5,
	rgb = "#1F75C4",
	colorMatrix = "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0";

	if (!arguments.length) {
		url = "glow";
	}

	function my() {

		var defs = this.append("defs");

		var filter = defs.append("filter")
		.attr("id", url)
		.attr("x", "0%")
		.attr("y", "0%")
		.attr("width", "110%")
		.attr("height", "120%")
		.call(function() {
			this.append("feColorMatrix")
			.attr("type", "matrix")
			.attr("values", colorMatrix);
			this.append("feGaussianBlur")
			.attr("stdDeviation", stdDeviation)
			.attr("result", "coloredBlur");
		});

		filter.append("feMerge")
		.call(function() {
			this.append("feMergeNode")
			.attr("in", "coloredBlur");
			this.append("feMergeNode")
			.attr("in", "SourceGraphic");
		});
	}

	my.rgb = function(value) {
		if (!arguments.length) return color;
		rgb = value;
		color = d3.rgb(value);
		var matrix = "0 0 0 red 0 0 0 0 0 green 0 0 0 0 blue 0 0 0 1 0";
		colorMatrix = matrix
		.replace("red", color.r/256)
		.replace("green", color.g/256)
		.replace("blue", color.b/256);
		return my;
	};

	my.stdDeviation = function(value) {
		if (!arguments.length) return stdDeviation;
		stdDeviation = value;
		return my;
	};

	return my;
}
function filter() {

	var defs = this.append("defs");

	var filter = defs.append("filter")
	.attr("id", "shadow")
	.attr("x", "0")
	.attr("y", "0")
	.attr("width", "140%")
	.attr("height", "140%")
	.call(function() {
		this.append("feOffset")
		.attr("result", "offOut")
		.attr("in", "SourceGraphic")
		.attr("dx", "20")
		.attr("dy", "20");

		this.append("feGaussianBlur")
		.attr("result", "blurOut")
		.attr("in", "offOut")
		.attr("stdDeviation", "10");

		this.append("feBlend")
		.attr("mode", "normal")
		.attr("in", "SourceGraphic")
		.attr("in2", "blurOut");
	});
}

