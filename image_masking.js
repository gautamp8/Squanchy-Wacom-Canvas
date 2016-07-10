var WILL = {
	color: Module.Color.from(0, 151, 212),
	backgroundColor: Module.Color.from(190, 143, 1),

	strokeWidth: 1.25,

	init: function(width, height) {
		this.initInkEngine(width, height);
		this.initEvents();
	},

	initInkEngine: function(width, height) {
		this.canvas = new Module.InkCanvas(document.getElementById("canvas"), width, height);
		this.canvas.clear(this.backgroundColor)

		this.maskLayer = this.canvas.createLayer();
		this.initImageLayer();

		this.brush = new Module.DirectBrush();
		this.pathBuilder = new Module.SpeedPathBuilder();
		this.smoothener = new Module.MultiChannelSmoothener(this.pathBuilder.stride);

		this.strokeRenderer = new Module.StrokeRenderer(this.canvas, this.canvas);
		this.strokeRenderer.configure({brush: this.brush, color: this.color, width: this.strokeWidth});
	},

	initImageLayer: function() {
		var url = location.toString();
		url = url.substring(0, url.lastIndexOf("/")) + "/image.png";

		Module.GLTools.prepareTexture(
			Module.GLTools.createTexture(GLctx.CLAMP_TO_EDGE, GLctx.LINEAR),
			url,
			function(texture) {
				this.imageLayer = this.canvas.createLayer({texture: texture, ownGlResources: true});
				this.canvas.blend(this.imageLayer, {mode: Module.BlendMode.NONE});
			},
			this
		);
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
					self.drawPath();
				}
			}, true);
		}
	},

	endStroke: function(e) {
		if (!this.inputPhase) return;

		this.inputPhase = Module.InputPhase.End;

		this.buildPath({x: e.clientX, y: e.clientY});
		this.drawPath();

		this.select();

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
	},

	drawPath: function() {
		this.strokeRenderer.draw(this.pathPart, this.inputPhase == Module.InputPhase.End);
	},

	select: function() {
		this.maskLayer.clear(Module.Color.from(0, 0, 0));
		this.maskLayer.fillPath(this.path, Module.Color.from(255, 255, 255), true);

		this.clear();
		this.canvas.blend(this.maskLayer, {mode: Module.BlendMode.MULTIPLY_NO_ALPHA});
	},

	clear: function() {
		this.canvas.clear(this.backgroundColor)
		this.canvas.blend(this.imageLayer, {mode: Module.BlendMode.NONE});
	}
};

Module.addPostScript(function() {
	WILL.init(1600, 600);
});