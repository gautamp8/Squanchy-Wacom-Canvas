var WILL = {
	backgroundColor: Module.Color.WHITE,

	strokes: new Array(),

	init: function(width, height) {
		this.initInkEngine(width, height);
		this.initEvents();
	},

	initInkEngine: function(width, height) {
		this.canvas = new Module.InkCanvas(document.getElementById("canvas"), width, height);
		this.strokesLayer = this.canvas.createLayer();

		this.clear();

		this.brush = new Module.DirectBrush();

		this.pathBuilder = new Module.SpeedPathBuilder();
		this.pathBuilder.setNormalizationConfig(720, 3900);
		this.pathBuilder.setPropertyConfig(Module.PropertyName.Width, 8, 112, 4, 4, Module.PropertyFunction.Power, 1, false);

		this.smoothener = new Module.MultiChannelSmoothener(this.pathBuilder.stride);
		this.intersector = new Module.Intersector();
	},

	initEvents: function() {
		var self = this;
		$(Module.canvas).on("mousedown", function(e) {self.beginStroke(e);});
		$(Module.canvas).on("mousemove", function(e) {self.moveStroke(e);});
		$(document).on("mouseup", function(e) {self.endStroke(e);});
	},

	beginStroke: function(e) {
		if (e.button != 0) return;

		this.inputPhase = Module.InputPhase.Begin;

		this.buildPath({x: e.clientX, y: e.clientY});
		this.erase();
	},

	moveStroke: function(e) {
		if (!this.inputPhase) return;

		this.inputPhase = Module.InputPhase.Move;
		this.pointerPos = {x: e.clientX, y: e.clientY};

		if (WILL.frameID != WILL.canvas.frameID) {
			var self = this;

			WILL.frameID = WILL.canvas.requestAnimationFrame(function() {
				if (self.inputPhase && self.inputPhase == Module.InputPhase.Move) {
					self.buildPath(self.pointerPos);
					self.erase();
				}
			}, true);
		}
	},

	endStroke: function(e) {
		if (!this.inputPhase) return;

		this.inputPhase = Module.InputPhase.End;

		this.buildPath({x: e.clientX, y: e.clientY});
		this.erase();

		delete this.inputPhase;
	},

	buildPath: function(pos) {
		if (this.inputPhase == Module.InputPhase.Begin)
			this.smoothener.reset();

		var pathPart = this.pathBuilder.addPoint(this.inputPhase, pos, Date.now()/1000);
		var smoothedPathPart = this.smoothener.smooth(pathPart, this.inputPhase == Module.InputPhase.End);
		var pathContext = this.pathBuilder.addPathPart(smoothedPathPart);

		this.pathPart = pathContext.getPathPart();
	},

	erase: function() {
		var dirtyArea = null;
		var strokesToRemove = new Array();

		this.intersector.setTargetAsStroke(this.pathPart, NaN);

		this.strokes.forEach(function(stroke) {
			var intervals = this.intersector.intersectWithTarget(stroke);
			var split = stroke.split(intervals, this.intersector.targetType);

			if (split.intersect) {
				dirtyArea = Module.RectTools.union(dirtyArea, split.bounds);
				strokesToRemove.push({stroke: stroke, replaceWith: split.strokes});
			}
		}, this);

		strokesToRemove.forEach(function(strokeToRemove) {
			this.strokes.replace(strokeToRemove.stroke, strokeToRemove.replaceWith);
		}, this);

		if (dirtyArea)
			this.redraw(dirtyArea);
	},

	redraw: function(dirtyArea) {
		if (!dirtyArea) dirtyArea = this.canvas.bounds;
		dirtyArea = Module.RectTools.ceil(dirtyArea);

		this.strokesLayer.clear(dirtyArea, this.backgroundColor);

		this.strokes.forEach(function(stroke) {
			var affectedArea = Module.RectTools.intersect(stroke.bounds, dirtyArea);
			if (affectedArea) WILL.strokesLayer.draw(stroke);
		}, this);

		this.refresh(dirtyArea);
	},

	refresh: function(dirtyArea) {
		this.canvas.blend(this.strokesLayer, {mode: Module.BlendMode.NONE, rect: Module.RectTools.ceil(dirtyArea)});
	},

	clear: function() {
		this.strokes = new Array();

		this.strokesLayer.clear(this.backgroundColor);
		this.canvas.clear(this.backgroundColor);
	},

	restore: function(fileBuffer) {
		var strokes = Module.InkDecoder.decode(new Uint8Array(fileBuffer));
		this.strokes.pushArray(strokes);
		this.redraw(strokes.bounds);
	}
};

Module.addPostScript(function() {
	Module.InkDecoder.getStrokeBrush = function(paint) {
		return WILL.brush;
	}

	WILL.init(1600, 600);

	var url = location.toString();
	url = url.substring(0, url.lastIndexOf("/")) + "/ship.data";

	var request = new XMLHttpRequest();

	request.onreadystatechange = function() {
		 if (this.readyState == this.DONE) {
			WILL.restore(this.response);
		}
	};

	request.open("GET", url, true);
	request.responseType = "arraybuffer";
	request.send();
});