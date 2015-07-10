
var data;
var chart;
var selectedRes;

var xScale;
var horizonY = 430;
var resMaxHeight = 60;
var getX;
var getHeight;

var incomingRefColor = '#f60';
var outgoingRefColor = '#33f';


function getResUrl(d) {
  return 'http://search.un.org/search?q=S%2FRES%2F' + d.res + '&output=xml_no_dtd&proxystylesheet=UN_ODS_test&client=UN_ODS_test&getfields=DocumentSymbol.Title.Size.PublicationDate&ProxyReload=1&sort=date%3AD%3AL%3Ad1&entqr=3&entsp=a&ud=1&filter=0&num=&site=ods_un_org';
}

function resComparator(a, b) {
  return a.res < b.res ? -1 : a.res > b.res ? 1 : 0;
}

function xToData(x) {
	var res = Math.floor(xScale.invert(x));
	
	// Fetch the closest resolution.
	for (var i = 0; i < data.nodes.length; i++) {
		var node = data.nodes[i];
		if (node.res > res) {
			var prevNode = data.nodes[i-1];
			if (prevNode && node.res - res > res - prevNode.res) {
				return prevNode;
			}
			else {
				return node;
			}
		}
	}
	
	return null;
}

function mouseToData(m) {
  var res = Math.floor(xScale.invert(m[0]));

  var neighborhood = data.nodes.filter(function(d) {
    return res - 10 < d.res && d.res < res + 10;
  });

  var nearest, nearestDistSq;
  neighborhood.forEach(function(d) {
    var dx = getX(d) - m[0];
    var dy = horizonY + 1 + getHeight(d) - m[1];
    var distSq = dx*dx + dy*dy;
    if (nearestDistSq == null || distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = d;
    }
  });

  return nearest;
}

function resToData(res) {
	for (var i = 0; i < data.nodes.length; i++) {
		if (data.nodes[i].res == res) {
			return data.nodes[i];
		}
	}
}

function selectResolution(res) {
	if (selectedRes == res) return;
	
	selectedRes = res;
  location.hash = res ? res : '';
	
	d3.selectAll('ul.refList li').remove();
		
	if (selectedRes) {
    d3.select('#container').attr('class', 'active');

		chart.selectAll('rect.resolution')
			.style('opacity', function(d) {
				return d.res == selectedRes ? 1 : 0.1});
				
		var incomingRefRes = data.edges.filter(function(d,i,a) {
			return d.target == selectedRes;
		}).map(function(d) { return {res: d.source, count: d.count}; })
      .sort(resComparator);
		
		var outgoingRefRes = data.edges.filter(function(d,i,a) {
			return d.source == selectedRes;
		}).map(function(d) { return {res: d.target, count: d.count}; })
      .sort(resComparator);
		
		$('#incomingRefPanel .refListLabel').text('Incoming References'
			+ ' (' + incomingRefRes.length + ' ' + (incomingRefRes.length == 1 ? 'document' : 'documents') + ')');
		
		d3.select('#incomingRefList').selectAll('li')
				.data(incomingRefRes)
			.enter()
				.append('li')
        .append('a')
          .attr('href', getResUrl)
          .attr('target', '_blank')
			  	.text(function(d) { return 'S/RES/' + d.res; });
		
		$('#outgoingRefPanel .refListLabel').text('Outgoing References'
			+ ' (' + outgoingRefRes.length + ' ' + (outgoingRefRes.length == 1 ? 'document' : 'documents') + ')');
		
		d3.select('#outgoingRefList').selectAll('li')
				.data(outgoingRefRes)
			.enter()
				.append('li')
        .append('a')
          .attr('href', getResUrl)
          .attr('target', '_blank')
			  	.text(function(d) { return 'S/RES/' + d.res; });
	}
	else {
    d3.select('#container').attr('class', 'inactive');

		chart.selectAll('rect.resolution')
			.style('opacity', 1);
			
		$('#incomingRefPanel .refListLabel').html('Incoming References');
		$('#outgoingRefPanel .refListLabel').html('Outgoing References');
	}
	
	emphasizeResolution(selectedRes);
}

function emphasizeResolution(res) {
	if (res == null) {
			chart.selectAll('path')
				.style('display', 'none');
		}
		else {
			chart.selectAll('path')
				.filter(function(d) { return d.target == res; })
				.sort(function(a,b) {
					a = a.source;
					b = b.source;
					if (a < b) return -1;
					if (a > b) return 1;
					return 0;
				})
						.style('display', 'inline')
						.attr('stroke', incomingRefColor)
						.style('opacity', 0)
					.transition()
						.delay(function(d,i) { return 300 + i*50; })
						.duration(300)
						.style('opacity', 1);
				
			chart.selectAll('path')
				.filter(function(d) { return d.source == res; })
				.sort(function(a,b) {
					a = a.target;
					b = b.target;
					if (a < b) return -1;
					if (a > b) return 1;
					return 0;
				})
						.style('display', 'inline')
						.attr('stroke', outgoingRefColor)
						.style('opacity', 0)
					.transition()
						.delay(function(d,i) { return i*50; })
						.duration(300)
						.style('opacity', 1);
			
			chart.selectAll('path')
				.filter(function(d) { return d.source != res && d.target != res; })
					.style('display', 'none');
		}
}

d3.json('step07_output02.json', function(json) {
	data = json;
	
	var w = 800, h = 560;
	resCount = d3.max(json.nodes, function(d) { return d.res; });
	
	xScale = d3.scale.linear()
		.domain([0, resCount])
		.range([0, w]);
	
	getX = function(d,i,a) {
		return xScale(d.res);
	};
	
	var getResLabelX = function(x) {
		return Math.max(62, Math.min(w - 62, x));
	};
	
	var hScale = d3.scale.pow()
		.exponent(0.5)
		.domain([0, 150])
		.range([1, resMaxHeight]);
	
	getHeight = function(d,i,a) {
		return hScale(d['in']);
	};
	
	var getPathData = function(d,i,a) {
		var x0 = xScale(d.source), x1 = xScale(d.target);
		var dx = x0 - x1;
		var r = Math.abs(dx) / 2;
		return 'M ' + x1 + ',' + horizonY + ' '
			+ 'a ' + r + ',' + r + ' 0 0,1 ' + dx + ',0';
	};

	chart = d3.select('#container')
    .attr('class', 'inactive')
		.append('svg:svg')
			.attr('id', 'chart')
			.attr('width', w + 50)
			.attr('height', h);

	var backing = chart.append('svg:rect')
		.attr('class', 'backing')
		.attr('y', horizonY + 1)
		.attr('width', w)
		.attr('height', 96);

	var decades = d3.nest()
		.key(function(d) { return Math.floor(d.year / 10) * 10; })
		.rollup(function(ds) { return [ds[0].res, ds[ds.length-1].res]; })
		.entries(data.nodes);

	var decadeRects = chart.selectAll('rect.decade')
			.data(decades)
		.enter().append('svg:rect')
			.attr('class', 'decade')
			.attr('x', function(d) { return xScale(d.values[0]); })
			.attr('y', horizonY + 1)
			.attr('width', function(d) {
				return xScale(d.values[1]) - xScale(d.values[0]) - 1;
			})
			.attr('height', 96);

  var decadeLabels = chart.selectAll('text.decade')
      .data(decades)
    .enter().append('svg:text')
      .attr('class', 'decade')
      .attr('x', function(d) { return (xScale(d.values[0]) + xScale(d.values[1])) / 2; })
      .attr('y', horizonY + 110)
      .text(function(d) { return d.key == 2000 ? '2000s' : String(d.key).substring(2) + 's'; });
	
	var ticks = chart.selectAll('line.tick')
			.data(hScale.ticks(4))
		.enter().append('svg:line')
			.attr('class', 'tick')
			.attr('x1', 0)
			.attr('x2', w)
			.attr('y1', function(d) { return horizonY + hScale(d); })
			.attr('y2', function(d) { return horizonY + hScale(d); });
	
	var labels = chart.selectAll('text.tick')
			.data(hScale.ticks(4))
		.enter().append('svg:text')
			.attr('class', 'tick')
			.attr('x', w + 4)
			.attr('y', function(d) { return horizonY + hScale(d); })
			.text(String);
	
	var axisLabel = chart.append('svg:text')
		.attr('class', 'y-axis')
		.attr('transform', 'rotate(90) translate('
			+ (horizonY - 15) + ',' + -(w + 35) + ')')
		.text('Incoming References');

	var node = chart.selectAll('rect.resolution')
			.data(json.nodes)
		.enter().append('svg:rect')
			.attr('class', 'resolution')
			.attr('x', getX)
			.attr('y', horizonY + 1)
			.attr('width', 1)
			.attr('height', getHeight);
	
	node.append('title')
		.text(function(d) { return "S/RES/" + d.res; });
	
	var edge = chart.selectAll('path')
			.data(json.edges)
		.enter().append('svg:path')
			.attr('fill', 'none')
			.attr('stroke-width', 1)
			.attr('d', getPathData);
	
	// Sets some styles.
	emphasizeResolution(null);
	
	var resLabel = chart.append('svg:text')
		.attr('class', 'resLabel')
		.style('display', 'none');

  var resInfo = chart.append('svg:text')
    .attr('class', 'resInfo')
    .style('display', 'none');
	
	var hitArea = chart.append('svg:rect')
		.attr('class', 'hitArea')
		.attr('y', horizonY + 1)
		.attr('width', w)
		.attr('height', 96);
		
	hitArea
		.on('mousemove', function(g, i) {
			var data = mouseToData(d3.svg.mouse(this));
			if (data) {
				resLabel
					.style('display', 'inline')
					.style('font-weight', 'normal')
					.attr('x', getResLabelX(xScale(data.res)))
					.attr('y', horizonY + resMaxHeight + 16)
					.text('S/RES/' + data.res);

        var incoming = data['in'];
        resInfo
          .style('display', 'inline')
					.attr('x', getResLabelX(xScale(data.res)))
					.attr('y', horizonY + resMaxHeight + 28)
					.text(incoming == 1 ? "1 incoming reference" : incoming + " incoming references");
					
				chart.selectAll('rect.resolution')
					.style('opacity', function(d) { return d.res == data.res ? 1 : 0.1});
			}
		})
		.on('click', function(g, i) {
			d3.event.stopPropagation();
			
			var data = mouseToData(d3.svg.mouse(this));
			selectResolution(data.res);
		})
		.on('mouseout', function(g, i) {
			
			if (selectedRes) {
				resLabel
					.style('display', 'inline')
					.style('font-weight', 'bold')
					.attr('x', getResLabelX(xScale(selectedRes)))
					.attr('y', horizonY + resMaxHeight + 16)
					.text('S/RES/' + selectedRes);

        var incoming = resToData(selectedRes)['in'];
        resInfo
          .style('display', 'inline')
					.attr('x', getResLabelX(xScale(selectedRes)))
					.attr('y', horizonY + resMaxHeight + 28)
					.text(incoming == 1 ? "1 incoming reference" : incoming + " incoming references");

				chart.selectAll('rect.resolution')
					.style('opacity', function(d) { return d.res == selectedRes ? 1 : 0.1});
			}
			else {
				resLabel
					.style('display', 'none');

        resInfo
          .style('display', 'none');
				
				chart.selectAll('rect.resolution')
					.style('opacity', 1);
			}
		});
		
	d3.select('html').on('click', function() {
  	switch (d3.event.target.localName)
		{
			case 'html':
			case 'body':
			case 'svg':
      case 'div':
				selectResolution();
				
				chart.selectAll('rect.resolution')
					.style('opacity', 1);
					
				resLabel
					.style('display', 'none');
					
				resInfo
					.style('display', 'none');
				break;
		}
	});

  var fragment = String(location.hash);
  if (fragment && fragment.length > 0) {
    if (fragment.charAt(0) == '#') {
      fragment = fragment.substring(1);
    }
		var re = /^(?:S\/RES\/)?(\d+)$/i;
		var match = re.exec(fragment);
		if (match && match.length > 1) {
			var maxRes = data.nodes[data.nodes.length - 1].res;
			var res = Math.max(1, Math.min(maxRes, parseInt(match[1])));
			$('#jumpInput').val(res);
      selectResolution(res);
    }
  }
});

$(function() {
  $('#jumpInput').keypress(function(evt) {
    var code = evt.keyCode || evt.which;
    if (code == 13) {
      $('#jumpButton').trigger('click');
    }
  });

	$('#jumpButton').button().click(function(evt) {
		evt.stopPropagation();
		
		var text = $('#jumpInput').val();
		var re = /^(?:S\/RES\/)?(\d+)$/i;
		var match = re.exec(text);
		if (match && match.length > 1) {
			var maxRes = data.nodes[data.nodes.length - 1].res;
			var res = Math.max(1, Math.min(maxRes, parseInt(match[1])));
			$('#jumpInput').val(res);
			selectResolution(res);
		}
		else {
			alert("Unable to understand resolution number. Please enter only numbers.");
		}
	});
});




