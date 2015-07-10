
ScrRel03GraphView = function(config){
	// Constructor with no arguments is used for subclasses.
	if (arguments.length <= 0) return;
	
	DirectGraphView.call(this, config);
    
    this.highlightedNodes = [];
    this.highlightedEdges = [];
};

ScrRel03GraphView.prototype = new DirectGraphView();
ScrRel03GraphView.prototype.constructor = ScrRel03GraphView;

ScrRel03GraphView.prototype.validate = function() {
	DirectGraphView.prototype.validate.call(this);

	
	
	return true;
};


/**
 * @param {Object} constellation
 * @constructor
 */
ScrRel03Layout = function(constellation) {
	if (arguments.length <= 0) return;
	Layout.call(this, constellation);
	
	this.timeoutId = null;
	
	this.toBePlacedNodes = [];
	
	this.delayStartTime = NaN;
	
	this.velocityLimit = 20;
	this.nodeMouseDown = false;
	
	this.ringRadius = 350;
};
window["ScrRel03Layout"] = ScrRel03Layout;

ScrRel03Layout.prototype = new Layout();
ScrRel03Layout.prototype.constructor = ScrRel03Layout;

ScrRel03Layout.prototype.setConstellation = function(constellation) {
	if (this.constellation) {
		jQuery(this.constellation).unbind('nodeAdded');
		
		if (this.timeoutId) clearTimeout(this.timeoutId);
	}
	
	Layout.prototype.setConstellation.call(this, constellation);

	if (this.constellation) {
		jQuery(this.constellation).bind('nodeAdded', {context: this}, function(event, node) {
			event.data.context.nodeAddedHandler(event, node);
		});
		
		this.step();
	}
};
ScrRel03Layout.prototype["setConstellation"] = ScrRel03Layout.prototype.setConstellation;

/**
 * Called by Constellation when the view changes.
 */
ScrRel03Layout.prototype.viewChanged = function() {
	
};
ScrRel03Layout.prototype["viewChanged"] = ScrRel03Layout.prototype.viewChanged;

ScrRel03Layout.prototype.nodeAddedHandler = function(event, node) {
	// Don't place the node right away. Wait for its edges to load.
	this.toBePlacedNodes.push(node);
};

ScrRel03Layout.prototype.step = function() {
	var baseEdgeLength = 100;
	var attractionFactor = 0.2;
	var repulsionFactor = 0.2;
	var dampingConstant = 0.3;
	
	// Place new nodes.
	while (this.toBePlacedNodes.length > 0) {
		this.setNodeInitialPosition(this.toBePlacedNodes.shift());
	}
	
	// FIXME: Shouldn't be calling concat here.
	var nodes = this.constellation.getNodes();
	// FIXME: Naive implementation. Optimize!
	for (var i = 0; i < nodes.length; i++) {
		var nodeA = nodes[i];
		for (var j = i + 1; j < nodes.length; j++) {
			var nodeB = nodes[j];
			
			var distanceX = nodeB.x - nodeA.x;
			var distanceY = nodeB.y - nodeA.y;
			if (distanceX == 0 && distanceY == 0) {
				distanceX = Math.random() * 0.5;
				distanceY = Math.random() * 0.5;
			}
			var distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
			
			// FIXME: Scale the preferred distance.
			var preferredDistance = baseEdgeLength;
			var deltaX = distanceX - (distanceX / distance * preferredDistance);
			var deltaY = distanceY - (distanceY / distance * preferredDistance);
			
			var fx = 0;
			var fy = 0;
			
			var hasEdge = false;
			for (var k = 0; k < nodeA.edges.length; k++) {
				var edge = nodeA.edges[k];
				if (edge.tailNode.id == nodeB.id || edge.headNode.id == nodeB.id) {
					hasEdge = true;
				}
			}
			
			if (hasEdge && distance > preferredDistance) {
				fx = deltaX * attractionFactor;
				fy = deltaY * attractionFactor;
			}
			else if (distance < preferredDistance) {
				fx = deltaX * repulsionFactor;
				fy = deltaY * repulsionFactor;
			}
			
			var modifier;
			var edgeLength;
			
			modifier = 1;
			edgeLength = nodeA.edges.length;
			if (edgeLength > 0) {
				modifier = 1 / Math.pow(edgeLength, 1 / 3);
			}
			
			nodeA.ax += fx * modifier;
			nodeA.ay += fy * modifier;
			
			modifier = 1;
			edgeLength = nodeB.edges.length;
			if (edgeLength > 0) {
				modifier = 1 / Math.pow(edgeLength, 1 / 3);
			}
			
			nodeB.ax -= fx * modifier;
			nodeB.ay -= fy * modifier;
		}
	}
	
	for (i = 0; i < nodes.length; i++) {
		var node = nodes[i];
		
		node.ax -= node.vx * dampingConstant;
		node.ay -= node.vy * dampingConstant;
		
		node.vx += node.ax;
		node.vy += node.ay;
		
		node.x += node.vx;
		node.y += node.vy;
		
		node.ax = 0;
		node.ay = 0;
	}
	
	// Keep the touch-dragged nodes under the mouse.
	for (var key in this.constellation.touchMetadata) {
		var touchMetadata = this.constellation.touchMetadata[key];
		if (touchMetadata.node) {
			var touch = touchMetadata.touch;
			var dragNode = touchMetadata.node;
			
			var viewportX = this.constellation.pageToViewportX(touch.pageX, touch.pageY)
				- touchMetadata.nodeOffsetX;
			var viewportY = this.constellation.pageToViewportY(touch.pageX, touch.pageY)
				- touchMetadata.nodeOffsetY;
			dragNode.x = this.constellation.viewportToWorldX(viewportX, viewportY);
			dragNode.y = this.constellation.viewportToWorldY(viewportX, viewportY);
		}
	}
	
	jQuery(this).trigger('change');
	
	if (this.timeoutId) clearTimeout(this.timeoutId);
	this.timeoutId = setTimeout(function(constellation) {
		return function() {
			constellation.step();
		};
	}(this), 40);
};

ScrRel03Layout.prototype.setNodeInitialPosition = function(node) {
	var x = 0, y = 0;
	
	// Get the average position of all neighbour nodes that have already been placed.
	var placedNeighbors = node.getNeighborNodes().filter(this.filterPlacedNodes);
	var averagePos = this.getAveragePosition(placedNeighbors);
	
	if (placedNeighbors.length > 1) {
		// The node has neighbors so place it between them.
		x = averagePos.x;
		y = averagePos.y;
	}
	else if (placedNeighbors.length > 0) {
		// Only one neighbor so place it opposite that neighbor's neighbors (cousins).
		var neighborNode = placedNeighbors[0];
		var placedCousins = neighborNode.getNeighborNodes().filter(this.filterPlacedNodes);
		
		if (placedCousins.length > 0) {
			var cousinsAveragePos = this.getAveragePosition(placedCousins);
			var offset = {
				'x': neighborNode.x - cousinsAveragePos.x,
				'y': neighborNode.y - cousinsAveragePos.y
			};
			var offsetLength = Math.sqrt(offset.x * offset.x + offset.y * offset.y);
			
			x = neighborNode.x + 50 * offset.x / offsetLength;
			y = neighborNode.y + 50 * offset.y / offsetLength;
		}
		else {
			// No placed cousins so place the node over the neighbor.
			x = neighborNode.x;
			y = neighborNode.y;
		}
	}
	
	// Add random jitter so nodes don't end up in the same spot.
	node.x = x + Math.random() - 0.5;
	node.y = y + Math.random() - 0.5;
};

ScrRel03Layout.prototype.filterPlacedNodes = function(node, index, array) {
	return node.x != null || node.y != null;
};

ScrRel03Layout.prototype.getAveragePosition = function(nodes) {
	if (nodes.length <= 0) return null;
	
	var x = 0, y = 0;
	for (var i = 0; i < nodes.length; i++) {
		var node = nodes[i];
		x += node.x;
		y += node.y;
	}
	return {'x': x / nodes.length, 'y': y / nodes.length};
};


/**
 * 
 * @param constellation
 * @param nodeId
 * @param data
 * @returns {ScrRel03NodeRenderer}
 * @constructor
 */
ScrRel03NodeRenderer = function(constellation, nodeId, data) {
	NodeRenderer.call(this, constellation, nodeId, data);
};

ScrRel03NodeRenderer.prototype = new NodeRenderer();
ScrRel03NodeRenderer.prototype.constructor = ScrRel03NodeRenderer;

ScrRel03NodeRenderer.prototype.defaultStyles = {};

ScrRel03NodeRenderer.prototype.create = function(){
	var svg = this.constellation.svg;
	var container = this.constellation.getNodeContainer();
	
	// Page rank domain: [0.00111868631811, 0.0160870357247]
	// Square roots: 0.03344676842551459 0.12683467871485307 (scale by area)
	var radius = 10 + 40 * (Math.sqrt(this.data.PageRank) - 0.03344676842551459) / (0.12683467871485307 - 0.03344676842551459);

	var fillColor = '#'
		+ parseInt(this.data.r).toString(16)
		+ parseInt(this.data.g).toString(16)
		+ parseInt(this.data.b).toString(16);
	
	var group = svg.group(container, {'display': 'none'});
	this.renderer = {
		group: group,
		outer: svg.circle(group,  0, 0, radius, {fill: fillColor, opacity: 0.4}),
		inner: svg.circle(group,  0, 0, radius - 4, {fill: fillColor, opacity: 0.8}),
		label: svg.text(group, 22, 0, this.getStyle('label'), {
			'style': '-webkit-user-select: none;-khtml-user-select: none;-moz-user-select: none;-o-user-select: none;user-select: none;',
			'fontFamily': 'Arial',
			'fontSize': 12,
			'fontWeight': 'bold',
			'fill': '#cccccc',
			'textAnchor': 'left',
			
			// HACK: Better cross-browser compatibility with 'dy'
			//dominantBaseline: 'central'
			'dy': '.35em'
		})
	};
	
	jQuery(this.renderer.inner)
		.bind('mouseover', {'context':this}, function(event) {
			event.data.context.constellation.nodemouseoverHandler(event, event.data.context);
		})
		.bind('mouseout', {'context':this}, function(event) {
			event.data.context.constellation.nodemouseoutHandler(event, event.data.context);
		})
		.bind('mousedown', {'context':this}, function(event) {
			event.data.context.constellation.nodemousedownHandler(event, event.data.context);
		})
		.bind('mouseup', {'context':this}, function(event) {
			event.data.context.constellation.nodemouseupHandler(event, event.data.context);
		})
		.bind('click', {'context':this}, function(event) {
			event.data.context.constellation.nodeclickHandler(event, event.data.context);
		});
};

ScrRel03NodeRenderer.prototype.draw = function() {
	// Update the display at the beginning of the draw call so getBBox doesn't fail in Firefox.
	jQuery(this.renderer.group).css('display', 'inline');
	
	this.position();
};

ScrRel03NodeRenderer.prototype.position = function() {
	jQuery(this.renderer.group)
		.attr('transform', 'translate(' + this.x + ',' + this.y + ')');
};

ScrRel03NodeRenderer.prototype.destroy = function() {
	jQuery(this.renderer.group).remove();
	this.renderer = null;
};

/**
 * 
 * @param constellation
 * @param edgeId
 * @param tailNodeRenderer
 * @param headNodeRenderer
 * @param data
 * @returns {ScrRel03EdgeRenderer}
 * @constructor
 */
ScrRel03EdgeRenderer = function(constellation, edgeId, tailNodeRenderer, headNodeRenderer, data) {
	EdgeRenderer.call(this, constellation, edgeId, tailNodeRenderer, headNodeRenderer, data);
};

ScrRel03EdgeRenderer.prototype = new EdgeRenderer();
ScrRel03EdgeRenderer.prototype.constructor = ScrRel03EdgeRenderer;

ScrRel03EdgeRenderer.prototype.defaultStyles = {};

ScrRel03EdgeRenderer.prototype.create = function() {
	var svg = this.constellation.svg;
	var container = this.constellation.getEdgeContainer();
	this.renderer = {
		line: svg.line(container, 0, 0, 10, 0, {
			'display': 'none',
			'opacity': 0.6,
			'stroke': '#cccccc',
			'strokeWidth': 3
		})
	};
	
	jQuery(this.renderer.line)
		.bind('mouseover', {'context':this}, function(event) {
			event.data.context.constellation.edgemouseoverHandler(event, event.data.context);
		})
		.bind('mouseout', {'context':this}, function(event) {
			event.data.context.constellation.edgemouseoutHandler(event, event.data.context);
		})
		.bind('mousedown', {'context':this}, function(event) {
			event.data.context.constellation.edgemousedownHandler(event, event.data.context);
		})
		.bind('mouseup', {'context':this}, function(event) {
			event.data.context.constellation.edgemouseupHandler(event, event.data.context);
		})
		.bind('click', {'context':this}, function(event) {
			event.data.context.constellation.edgeclickHandler(event, event.data.context);
		});
};

ScrRel03EdgeRenderer.prototype.draw = function() {
	jQuery(this.renderer.line)
		.attr('x1', this.tailNode.x)
		.attr('y1', this.tailNode.y)
		.attr('x2', this.headNode.x)
		.attr('y2', this.headNode.y)
		.css('display', 'inline');
};

ScrRel03EdgeRenderer.prototype.destroy = function() {
	jQuery(this.renderer.line).remove();
};
