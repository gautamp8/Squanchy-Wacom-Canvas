var WILL = {
	// var eraseBool = true;	
	backgroundColor: Module.Color.WHITE,
	color: Module.Color.from(204, 204, 204),

	strokes: new Array(),

	init: function(width, height) {
		this.initInkEngine(width, height);
		this.initEvents();
	},

	initInkEngine: function(width, height) {
		this.canvas = new Module.InkCanvas(document.getElementById("canvas"), width, height);
		this.strokesLayer = this.canvas.createLayer();

		this.clear();

		this.brush = new Module.SolidColorBrush();

		this.pathBuilder = new Module.SpeedPathBuilder();
		this.pathBuilder.setNormalizationConfig(5, 210);
		this.pathBuilder.setPropertyConfig(Module.PropertyName.Width, 1, 3.2, NaN, NaN, Module.PropertyFunction.Sigmoid, 0.6, true);

		this.smoothener = new Module.MultiChannelSmoothener(this.pathBuilder.stride);

		this.strokeRenderer = new Module.StrokeRenderer(this.canvas);
		this.strokeRenderer.configure({brush: this.brush, color: this.color});
		
		// var eraseButton = this.getElementById('erase');
       
  //       eraseButton.addEventListener('click', function(event) {
  //       if(eraseBool == false){
  //       	 eraseBool = true;
  //       } else{
  //        	eraseBool = true;
  //       }
        
  //       });
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
		this.drawPath();

		// if (true) {
		// 	this.erase();
		// }
		// else{
			self.drawPath();
		// }
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
					
					// if (true) {
					// 	this.erase();
					// }
					// else{
						self.drawPath();
					// }
				}
			}, true);
		}
	},

	endStroke: function(e) {
		if (!this.inputPhase) return;

		this.inputPhase = Module.InputPhase.End;

		this.buildPath({x: e.clientX, y: e.clientY});

		var stroke = new Module.Stroke(this.brush, this.path, NaN, this.color, 0, 1);
		this.strokes.push(stroke);
		
		// if (true) {
		// 		this.erase();
		// 	}
		// else {
			this.drawPath();
		// }

		delete this.inputPhase;
	},

	buildPath: function(pos) {
		if (this.inputPhase == Module.InputPhase.Begin)
			this.smoothener.reset();

		var pathPart = this.pathBuilder.addPoint(this.inputPhase, pos, Date.now()/1000);
		var smoothedPathPart = this.smoothener.smooth(pathPart, this.inputPhase == Module.InputPhase.End);
		var pathContext = this.pathBuilder.addPathPart(smoothedPathPart);

		this.pathPart = pathContext.getPathPart();
		this.path = pathContext.getPath();

		if (this.inputPhase == Module.InputPhase.Move) {
			var preliminaryPathPart = this.pathBuilder.createPreliminaryPath();
			var preliminarySmoothedPathPart = this.smoothener.smooth(preliminaryPathPart, true);

			this.preliminaryPathPart = this.pathBuilder.finishPreliminaryPath(preliminarySmoothedPathPart);
		}
	},

	drawPath: function() {
		if (this.inputPhase == Module.InputPhase.Begin) {
			this.strokeRenderer.draw(this.pathPart, false);
			this.strokeRenderer.blendUpdatedArea();
		}
		else if (this.inputPhase == Module.InputPhase.Move) {
			this.strokeRenderer.draw(this.pathPart, false);
			this.strokeRenderer.drawPreliminary(this.preliminaryPathPart);

			this.canvas.clear(this.strokeRenderer.updatedArea, this.backgroundColor);
			this.canvas.blend(this.strokesLayer, {rect: this.strokeRenderer.updatedArea});

			this.strokeRenderer.blendUpdatedArea();
		}
		else if (this.inputPhase == Module.InputPhase.End) {
			this.strokeRenderer.draw(this.pathPart, true);
			this.strokeRenderer.blendStroke(this.strokesLayer, Module.BlendMode.NORMAL);

			this.canvas.clear(this.strokeRenderer.strokeBounds, this.backgroundColor);
			this.canvas.blend(this.strokesLayer, {rect: this.strokeRenderer.strokeBounds});
		}
	},

	redraw: function(dirtyArea) {
		if (!dirtyArea) dirtyArea = this.canvas.bounds;
		dirtyArea = Module.RectTools.ceil(dirtyArea);

		this.strokesLayer.clear(dirtyArea);

		this.strokes.forEach(function(stroke) {
			var affectedArea = Module.RectTools.intersect(stroke.bounds, dirtyArea);

			if (affectedArea) {
				this.strokeRenderer.draw(stroke);
				this.strokeRenderer.blendStroke(this.strokesLayer, stroke.blendMode);
			}
		}, this);

		this.refresh(dirtyArea);
	},

	refresh: function(dirtyArea) {
		this.canvas.blend(this.strokesLayer, {rect: Module.RectTools.ceil(dirtyArea)});
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

	clear: function() {
		this.strokes = new Array();

		// this.strokesLayer.clear(this.backgroundColor);
		// this.canvas.clear(this.backgroundColor);
	},

	load: function(e) {
		var input = e.currentTarget;
		var file = input.files[0];
		var reader = new FileReader();

		reader.onload = function(e) {
			WILL.clear();

			var strokes = Module.InkDecoder.decode(new Uint8Array(e.target.result));
			WILL.strokes.pushArray(strokes);
			WILL.redraw(strokes.bounds);
		};

		reader.readAsArrayBuffer(file);
	},

	save: function() {
		var data = Module.InkEncoder.encode(this.strokes);
		saveAs(data, "export.data", "application/octet-stream");
	},


};

Module.addPostScript(function() {
	Module.InkDecoder.getStrokeBrush = function(paint) {
		return WILL.brush;
	}

	WILL.init(800, 300);

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