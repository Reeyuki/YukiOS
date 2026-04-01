(function (jc) {
  function D(a, b) {
    function c() {}
    c.prototype = a;
    var d = new c(),
      e;
    for (e in b) d[e] = b[e];
    b.toString !== Object.prototype.toString && (d.toString = b.toString);
    return d;
  }
  function T(a, b) {
    if (null == b) return null;
    null == b.__id__ && (b.__id__ = pc++);
    var c;
    null == a.hx__closures__ ? (a.hx__closures__ = {}) : (c = a.hx__closures__[b.__id__]);
    null == c &&
      ((c = function () {
        return c.method.apply(c.scope, arguments);
      }),
      (c.scope = a),
      (c.method = b),
      (a.hx__closures__[b.__id__] = c));
    return c;
  }
  var dc = function () {
      return E.__string_rec(this, "");
    },
    ja = function () {};
  ja.__name__ = !0;
  ja.cca = function (a, b) {
    var c = a.charCodeAt(b);
    if (c == c) return c;
  };
  ja.substr = function (a, b, c) {
    if (null == c) c = a.length;
    else if (0 > c)
      if (0 == b) c = a.length + c;
      else return "";
    return a.substr(b, c);
  };
  ja.iter = function (a) {
    return {
      cur: 0,
      arr: a,
      hasNext: function () {
        return this.cur < this.arr.length;
      },
      next: function () {
        return this.arr[this.cur++];
      }
    };
  };
  Math.__name__ = !0;
  var la = function () {};
  la.__name__ = !0;
  la.string = function (a) {
    return E.__string_rec(a, "");
  };
  la.parseInt = function (a) {
    var b = parseInt(a, 10);
    0 != b || (120 != ja.cca(a, 1) && 88 != ja.cca(a, 1)) || (b = parseInt(a));
    return isNaN(b) ? null : b;
  };
  var ma = function () {};
  ma.__name__ = !0;
  ma.isSpace = function (a, b) {
    var c = ja.cca(a, b);
    return 8 < c && 14 > c ? !0 : 32 == c;
  };
  ma.ltrim = function (a) {
    for (var b = a.length, c = 0; c < b && ma.isSpace(a, c); ) ++c;
    return 0 < c ? ja.substr(a, c, b - c) : a;
  };
  ma.rtrim = function (a) {
    for (var b = a.length, c = 0; c < b && ma.isSpace(a, b - c - 1); ) ++c;
    return 0 < c ? ja.substr(a, 0, b - c) : a;
  };
  ma.trim = function (a) {
    return ma.ltrim(ma.rtrim(a));
  };
  ma.replace = function (a, b, c) {
    return a.split(b).join(c);
  };
  var h = function () {};
  h.__name__ = !0;
  h.set_background = function (a) {
    h.background = a & -1;
    return h.background;
  };
  h.set_imageSmoothingEnabled = function (a) {
    h.imageSmoothingEnabled = a;
    if (null != h.ctx) {
      var b = h.ctx;
      b.webkitImageSmoothingEnabled = a;
      b.mozImageSmoothingEnabled = a;
      b.msImageSmoothingEnabled = a;
      b.oImageSmoothingEnabled = a;
      b.imageSmoothingEnabled = a;
    }
    return a;
  };
  h.start = function (a, b, c, d, e, f) {
    h.started ||
      1 > b ||
      1 > c ||
      null == f ||
      ((h.transparent = e),
      (h.width = b),
      (h.height = c),
      h.set_background(d),
      (h.stage = f),
      window.setTimeout(function () {
        window.focus();
      }, 0),
      h.setup(a),
      f.triggerEvent(new Y("added")),
      t._init(),
      h.loop(),
      (h.started = !0));
  };
  h.setup = function (a) {
    null == a && (a = window.document.body);
    h.parent = a;
    var b = window.document.body;
    b.style.margin = "0";
    b.style.overflow = "hidden";
    h.c = window.document.createElement("canvas");
    h.c.width = h.width;
    h.c.height = h.height;
    h.c.style.position = "absolute";
    h.c.style.left = h.c.style.top = "0";
    h.c.style.transform = "translateZ(0px)";
    h.c.style.cursor = "default";
    a.appendChild(h.c);
    h.ctx = h.c.getContext("2d", { alpha: h.transparent });
    h.set_imageSmoothingEnabled(h.imageSmoothingEnabled);
    h.surface = new Ea(h.ctx);
    O._reset();
    h.input = new qb(h.c);
    G._init();
    h.input.addEventListener("click", h.onClick);
    h.input.addEventListener("mouseDown", h.onMouseDown);
    h.input.addEventListener("mouseUp", h.onMouseUp);
    h.input.addEventListener("move", h.onMouseMove);
  };
  h.loop = function () {
    O._update();
    if (t.get_done())
      h.wasLoaded ||
        (t.triggerEvent(new Fa("progress", 1)), (h.lastProgress = 1), t.triggerEvent(new Fa("finished", 1)));
    else {
      var a = t.get_progress();
      a != h.lastProgress && (t.triggerEvent(new Fa("progress", a)), (h.lastProgress = a));
    }
    h.wasLoaded = t.get_done();
    var b = h.scale;
    h.scale =
      window.innerWidth / window.innerHeight < h.width / h.height
        ? window.innerWidth / h.width
        : window.innerHeight / h.height;
    var c = Math.round(h.width * h.scale);
    a = Math.round(h.height * h.scale);
    h.scale != b && ((h.c.style.width = c + "px"), (h.c.style.height = a + "px"));
    b = Math.floor((window.innerWidth - c) / 2);
    b != h.offsetX && ((h.c.style.left = Math.floor((window.innerWidth - c) / 2) + "px"), (h.offsetX = b));
    c = Math.floor((window.innerHeight - a) / 2);
    c != h.offsetY && ((h.c.style.top = Math.floor((window.innerHeight - a) / 2) + "px"), (h.offsetY = c));
    h.updateMouseSprite();
    a = null != h.mouseSprite && h.mouseSprite.buttonMode ? "pointer" : "default";
    a != h.lastCursor && ((h.c.style.cursor = a), (h.lastCursor = a));
    var d = new Y("enterFrame");
    h.stage.cascadingCallback(function (e) {
      e.triggerEvent(d);
    });
    d = new Y("exitFrame");
    h.stage.cascadingCallback(function (e) {
      e.triggerEvent(d);
    });
    h.render();
    h.requestAnimationFrame(h.loop);
  };
  h.requestAnimationFrame = function (a) {
    var b = window;
    (b =
      b.requestAnimationFrame ||
      b.webkitRequestAnimationFrame ||
      b.mozRequestAnimationFrame ||
      b.oRequestAnimationFrame ||
      b.msRequestAnimationFrame)
      ? b(a)
      : window.setTimeout(a, 16);
  };
  h.render = function () {
    h.surface.reset();
    if (h.transparent) {
      var a = h.background >>> 24;
      255 > a && h.surface.clearRect(0, 0, h.width, h.height);
      h.surface.beginFill(h.background & 16777215, E.__cast(a, kc) / 255);
    } else h.surface.beginFill(h.background & 16777215, 1);
    h.surface.drawRect(0, 0, h.width, h.height);
    h.surface._ctx.globalAlpha = 1;
    h.renderSprite(h.stage, h.surface);
  };
  h.renderSprite = function (a, b) {
    if (a.visible && 0 != a.alpha) {
      b.save();
      b.translate(a.x, a.y);
      b.rotate((a.rotation * Math.PI) / 180);
      b.scale(a.scaleX, a.scaleY);
      var c = b._ctx.globalAlpha;
      b._ctx.globalAlpha *= a.alpha;
      b.reset(!0);
      a.graphics._paint(b);
      a.triggerEvent(new fb("render", b));
      for (var d = 0, e = a._children; d < e.length; ) {
        var f = e[d];
        ++d;
        h.renderSprite(f, b);
      }
      b.scale(1 / a.scaleX, 1 / a.scaleY);
      b._ctx.globalAlpha = c;
      b.restore();
    }
  };
  h.updateMouseSprite = function () {
    var a = h.updateMouseSpriteStep(h.stage, null);
    null == a && (a = h.stage);
    h.mouseSprite = a;
  };
  h.updateMouseSpriteStep = function (a, b) {
    if (a.visible) {
      if (a.mouseEnabled) {
        var c = a.getBounds();
        c.width -= 1e-4;
        c.height -= 1e-4;
        ya.pointInTransformedBounds(new Q(h.input.mouseX, h.input.mouseY), a._transform, c) && (b = a);
      }
      c = 0;
      for (var d = a._children; c < d.length; ) {
        var e = d[c];
        ++c;
        b = h.updateMouseSpriteStep(e, b);
      }
    }
    return b;
  };
  h.pageToGame = function (a, b) {
    return new Q((a - h.offsetX) / h.scale, (b - h.offsetY) / h.scale);
  };
  h.onClick = function (a) {
    h.updateMouseSprite();
    null != h.clickSprite && h.mouseSprite == h.clickSprite && h.triggerMouseEvent(h.clickSprite, a);
  };
  h.onMouseDown = function (a) {
    window.getSelection().removeAllRanges();
    var b = window.document.activeElement,
      c = b.tagName.toLowerCase();
    1 != a.which || ("input" != c && "textarea" != c) || b.setSelectionRange(0, 0);
    h.updateMouseSprite();
    h.clickSprite = h.mouseSprite;
    null != h.mouseSprite && h.triggerMouseEvent(h.mouseSprite, a);
  };
  h.onMouseUp = function (a) {
    h.updateMouseSprite();
    null != h.mouseSprite && h.triggerMouseEvent(h.mouseSprite, a);
  };
  h.onMouseMove = function (a) {
    h.updateMouseSprite();
    null != h.mouseSprite && h.triggerMouseEvent(h.mouseSprite, a);
  };
  h.triggerMouseEvent = function (a, b) {
    for (var c = (b.target = a); null != c; ) (c.triggerEvent(b), (c = c.parent));
  };
  var Sa = function () {
    this.listeners = new Ra();
  };
  Sa.__name__ = !0;
  Sa.prototype = {
    addEventListener: function (a, b) {
      var c = this.listeners;
      if (null != na[a] ? !c.existsReserved(a) : !c.h.hasOwnProperty(a)) {
        c = this.listeners;
        var d = [];
        null != na[a] ? c.setReserved(a, d) : (c.h[a] = d);
      }
      c = this.listeners;
      (null != na[a] ? c.getReserved(a) : c.h[a]).push(b);
    },
    removeEventListener: function (a, b) {
      var c = this.listeners;
      if (null != na[a] ? c.existsReserved(a) : c.h.hasOwnProperty(a)) {
        c = this.listeners;
        c = null != na[a] ? c.getReserved(a) : c.h[a];
        var d = c.indexOf(b);
        0 > d || c.splice(d, 1);
      }
    },
    triggerEvent: function (a) {
      var b = this.listeners,
        c = a.type;
      if (null != na[c] ? b.existsReserved(c) : b.h.hasOwnProperty(c)) {
        b = 0;
        c = this.listeners;
        var d = a.type;
        for (c = null != na[d] ? c.getReserved(d) : c.h[d]; b < c.length; ) ((d = c[b]), ++b, d(a));
      }
    },
    __class__: Sa
  };
  var t = function () {};
  t.__name__ = !0;
  t.triggerEvent = function (a) {
    t.events.triggerEvent(a);
  };
  t.addEventListener = function (a, b) {
    t.events.addEventListener(a, b);
  };
  t.removeEventListener = function (a, b) {
    t.events.removeEventListener(a, b);
  };
  t._init = function () {
    t.inited || (t.inited = !0);
  };
  t.createTask = function () {
    t.tasks.push(!1);
    return t.tasks.length - 1;
  };
  t.closeTask = function (a) {
    0 <= a && a < t.tasks.length && (t.tasks[a] = !0);
  };
  t.get_done = function () {
    if (!t.inited) return !1;
    if (t.finished) return !0;
    for (var a = 0, b = t.tasks.length; a < b; ) {
      var c = a++;
      if (!t.tasks[c]) return !1;
    }
    return (t.finished = !0);
  };
  t.get_progress = function () {
    if (!t.inited) return 0;
    if (t.finished) return 1;
    for (var a = 0, b = 0, c = t.tasks.length; b < c; ) {
      var d = b++;
      t.tasks[d] && ++a;
    }
    return a / t.tasks.length;
  };
  t.loadImage = function (a, b) {
    var c = new Image();
    c.src = a;
    if (!t.finished) {
      var d = t.createTask();
      c.onload = function () {
        t.closeTask(d);
        null != b && b(c);
      };
    }
    return c;
  };
  t.loadWebFonts = function (a, b) {
    var c = t.createTask();
    a.active = function () {
      t.closeTask(c);
      null != b && b();
    };
    WebFont.load(a);
  };
  t.loadTextFile = function (a, b) {
    var c = t.createTask(),
      d = new XMLHttpRequest();
    d.open("GET", a);
    d.onload = function () {
      t.closeTask(c);
      null != b && b(d.responseText);
    };
    d.send();
  };
  t.loadSound = function (a) {
    var b = t.createTask();
    a.onload = function () {
      t.closeTask(b);
    };
    return new Howl(a);
  };
  var O = function () {};
  O.__name__ = !0;
  O._reset = function () {
    O.startTime = O.absoluteTime();
    O.lastTime = 0;
  };
  O._update = function () {
    var a = O.get_currentMS();
    O.elapsedTime = a - O.lastTime;
    O.lastTime = a;
  };
  O.absoluteTime = function () {
    return new Date().getTime();
  };
  O.get_current = function () {
    return 0.001 * O.get_currentMS();
  };
  O.get_currentMS = function () {
    return O.absoluteTime() - O.startTime;
  };
  O.get_elapsed = function () {
    return 0.001 * O.elapsedTime;
  };
  O.get_elapsedMS = function () {
    return O.elapsedTime;
  };
  var ya = function () {};
  ya.__name__ = !0;
  ya.getColorString = function (a, b) {
    null == b && (b = 1);
    return "rgba(" + ((a & 16711680) >>> 16) + ", " + ((a & 65280) >>> 8) + ", " + (a & 255) + ", " + b + ")";
  };
  ya.pointInQuad = function (a, b, c, d, e) {
    e = c.subtract(b);
    b = a.subtract(b);
    d = d.subtract(c);
    c = a.subtract(c);
    a = Q.dot(e, b);
    e = Q.dot(e, e);
    c = Q.dot(d, c);
    d = Q.dot(d, d);
    return 0 <= a && a <= e && 0 <= c ? c <= d : !1;
  };
  ya.pointInTransformedBounds = function (a, b, c) {
    return null == a || null == b || null == c || 0 == c.width || 0 == c.height
      ? !1
      : ya.pointInQuad(
          a,
          b.apply(c.get_left(), c.get_top()),
          b.apply(c.get_right(), c.get_top()),
          b.apply(c.get_right(), c.get_bottom()),
          b.apply(c.get_left(), c.get_bottom())
        );
  };
  ya.drawImageSafe = function (a, b, c, d, e, f, m, k) {
    0 >= e ||
      0 >= f ||
      0 >= c + e ||
      c >= b.width ||
      0 >= d + f ||
      d >= b.height ||
      ((c += 0 > c ? -c : 0),
      (d += 0 > d ? -d : 0),
      c + e > b.width && (e = b.width - c),
      d + f > b.height && (f = b.height - d),
      a.drawImage(b, c, d, e, f, m, k, e, f));
  };
  var rb = function () {
    this.clear();
  };
  rb.__name__ = !0;
  rb.prototype = {
    get_length: function () {
      return this.items.length;
    },
    get_skipDraw: function () {
      return this.filling ? !1 : !this.stroking;
    },
    clear: function () {
      this.items = [];
      this.filling = this.stroking = !1;
      this.bounds = new z(0, 0, 0, 0);
    },
    _paint: function (a) {
      for (var b = 0, c = this.items; b < c.length; ) {
        var d = c[b];
        ++b;
        d.execute(a);
      }
      a.endFill();
      a.endStroke();
    },
    call: function (a, b) {
      this.items.push(Ga.callFunc(a, b));
    },
    beginFill: function (a, b) {
      null == b && (b = 1);
      null == a && (a = 0);
      this.call("beginFill", [a, b]);
      this.filling = !0;
    },
    endFill: function () {
      this.call("endFill");
      this.filling = !1;
    },
    beginStroke: function (a, b, c) {
      null == c && (c = 1);
      null == b && (b = 0);
      null == a && (a = 1);
      this.call("beginStroke", [a, b, c]);
      this.stroking = !0;
    },
    endStroke: function () {
      this.call("endStroke");
      this.stroking = !1;
    },
    drawRect: function (a, b, c, d) {
      this.get_skipDraw() || (this.bounds.combine(new z(a, b, c, d)), this.call("drawRect", [a, b, c, d]));
    },
    drawPath: function (a, b) {
      null == b && (b = !0);
      this.get_skipDraw() || (this.bounds.combine(z.containingPoints(a)), this.call("drawPath", [a, b]));
    },
    drawCircle: function (a, b, c) {
      this.get_skipDraw() ||
        (this.bounds.combine(new z(a - c, b - c, 2 * c, 2 * c)), this.call("drawCircle", [a, b, c]));
    },
    drawArc: function (a, b, c, d, e, f, m) {
      null == m && (m = !1);
      null == f && (f = !1);
      this.get_skipDraw() ||
        (this.bounds.combine(new z(a - c, b - c, 2 * c, 2 * c)), this.call("drawArc", [a, b, c, d, e, f, m]));
    },
    drawEllipse: function (a, b, c, d) {
      this.get_skipDraw() || (this.bounds.combine(new z(a, b, c, d)), this.call("drawEllipse", [a, b, c, d]));
    },
    drawImage: function (a, b, c) {
      this.call("drawImage", [a, b, c]);
    },
    drawText: function (a, b, c, d, e, f, m, k) {
      null == k && (k = 1.25);
      null == m && (m = "left");
      null == f && (f = "normal");
      this.get_skipDraw() || this.call("drawText", [a, b, c, d, e, f, m, k]);
    },
    __class__: rb
  };
  var x = function () {
    this.graphics = new rb();
    this._children = [];
    this._transformReverse = new gb();
    this._transform = new gb();
    this.mouseEnabled = this.buttonMode = !1;
    this.alpha = 1;
    this.visible = !0;
    this.rotation = 0;
    this.scaleX = this.scaleY = 1;
    this.x = this.y = 0;
    this.listeners = new Ra();
  };
  x.__name__ = !0;
  x.__super__ = Sa;
  x.prototype = D(Sa.prototype, {
    set_x: function (a) {
      this.x != a && ((this.x = a), this._updateTransform());
      return this.x;
    },
    set_y: function (a) {
      this.y != a && ((this.y = a), this._updateTransform());
      return this.y;
    },
    set_scaleX: function (a) {
      this.scaleX != a && ((this.scaleX = a), this._updateTransform());
      return this.scaleX;
    },
    set_scaleY: function (a) {
      this.scaleY != a && ((this.scaleY = a), this._updateTransform());
      return this.scaleY;
    },
    set_rotation: function (a) {
      this.rotation != a && ((this.rotation = a), this._updateTransform());
      return this.rotation;
    },
    set_alpha: function (a) {
      return (this.alpha = 0 > a ? 0 : 1 < a ? 1 : a);
    },
    get_stage: function () {
      return h.stage;
    },
    get_width: function () {
      return this.getBounds().width * this.scaleX;
    },
    set_width: function (a) {
      this.set_scaleX(a / this.getBounds().width);
      return a;
    },
    get_height: function () {
      return this.getBounds().height * this.scaleY;
    },
    set_height: function (a) {
      this.set_scaleY(a / this.getBounds().height);
      return a;
    },
    addChild: function (a) {
      null != a &&
        a != this.get_stage() &&
        a != this &&
        (null != a.parent && a.parent.removeChild(a),
        this._children.push(a),
        (a.parent = this),
        a._updateTransform(),
        a.triggerEvent(new Y("added")));
    },
    addChildAt: function (a, b) {
      null != a &&
        a != this.get_stage() &&
        a != this &&
        (null != a.parent && a.parent.removeChild(a),
        this._children.splice(b, 0, a),
        (a.parent = this),
        a._updateTransform(),
        a.triggerEvent(new Y("added")));
    },
    removeChild: function (a) {
      null != a &&
        a.parent == this &&
        ((a.parent = null),
        this._children.splice(this._children.indexOf(a), 1),
        a._updateTransform(),
        a.triggerEvent(new Y("removed")));
    },
    removeChildAt: function (a) {
      if (0 <= a && a < this._children.length) {
        var b = this._children[a];
        b.parent = null;
        b._updateTransform();
        this._children.splice(a, 1);
        b.triggerEvent(new Y("removed"));
      }
    },
    removeChildren: function () {
      for (var a = this._children.length; 0 <= a--; ) this.removeChild(this._children[a]);
    },
    getChildIndex: function (a) {
      return this._children.indexOf(a);
    },
    setChildIndex: function (a, b) {
      var c = this.getChildIndex(a);
      0 <= c && (this._children.splice(c, 1), this._children.splice(b, 0, a));
    },
    swapDepths: function (a, b) {
      var c = this.getChildIndex(a),
        d = this.getChildIndex(b);
      0 <= c && 0 <= d && ((this._children[c] = b), (this._children[d] = a));
    },
    globalToLocal: function (a, b) {
      return this._transformReverse.apply(a, b);
    },
    localToGlobal: function (a, b) {
      return this._transform.apply(a, b);
    },
    _updateTransform: function () {
      null != this.parent ? this._transform.copy(this.parent._transform) : this._transform.identity();
      this._transform.translate(this.x, this.y);
      this._transform.rotate((this.rotation * Math.PI) / 180);
      this._transform.scale(this.scaleX, this.scaleY);
      this._transformReverse.identity();
      for (var a = this; null != a; )
        (this._transformReverse.scale(1 / a.scaleX, 1 / a.scaleY),
          this._transformReverse.rotate((-a.rotation * Math.PI) / 180),
          this._transformReverse.translate(-a.x, -a.y),
          (a = a.parent));
      a = 0;
      for (var b = this._children; a < b.length; ) {
        var c = b[a];
        ++a;
        c._updateTransform();
      }
    },
    getBoundsSelf: function () {
      return new z(0, 0, 0, 0);
    },
    getBounds: function () {
      var a = [this.getBoundsSelf(), this.graphics.bounds];
      return z.combineMultiple(a);
    },
    hitTestPoint: function (a) {
      return this.getBounds().contains(a);
    },
    cascadingCallback: function (a) {
      if (null != a) {
        a(this);
        for (var b = 0, c = this._children; b < c.length; ) {
          var d = c[b];
          ++b;
          d.cascadingCallback(a);
        }
      }
    },
    __class__: x
  });
  var I = function (a) {
    this.imageWidth = this.imageHeight = 0;
    var b = this;
    x.call(this);
    null != a && this.create(a);
    this.addEventListener("render", function (c) {
      b.render(c.surface);
    });
  };
  I.__name__ = !0;
  I.fromFile = function (a, b) {
    var c = new I(null);
    t.loadImage(a, function (d) {
      c.create(d);
      null != b && b();
    });
    return c;
  };
  I.__super__ = x;
  I.prototype = D(x.prototype, {
    get_rect: function () {
      return new z(
        0,
        0,
        null != this.clipRect ? this.clipRect.width : 0,
        null != this.clipRect ? this.clipRect.height : 0
      );
    },
    set_clipRect: function (a) {
      return (this.clipRect = a);
    },
    create: function (a) {
      if (null == this.image) {
        this.image = a;
        var b = a.width,
          c = a.height;
        "svg" == ja.substr(a.src, a.src.length - 3, null) &&
          (window.document.body.appendChild(a),
          (b = a.offsetWidth),
          (c = a.offsetHeight),
          window.document.body.removeChild(a));
        this.imageWidth = b;
        this.imageHeight = c;
        this.set_clipRect(new z(0, 0, b, c));
      }
    },
    getBoundsSelf: function () {
      return new z(0, 0, null != this.image ? this.clipRect.width : 0, null != this.image ? this.clipRect.height : 0);
    },
    render: function (a) {
      null != this.image &&
        a.drawImage(
          this.image,
          this.clipRect,
          0,
          0,
          0 != this.clipRect.x ||
            0 != this.clipRect.y ||
            this.clipRect.width != this.imageWidth ||
            this.clipRect.height != this.imageHeight
        );
    },
    __class__: I
  });
  var Y = function (a) {
    this.type = a;
  };
  Y.__name__ = !0;
  Y.prototype = { __class__: Y };
  var Ta = function (a) {
    this.type = a;
  };
  Ta.__name__ = !0;
  Ta.__super__ = Y;
  Ta.prototype = D(Y.prototype, { __class__: Ta });
  var Ua = function (a, b) {
    this.type = a;
    this.keyCode = b;
  };
  Ua.__name__ = !0;
  Ua.__super__ = Y;
  Ua.prototype = D(Y.prototype, { __class__: Ua });
  var Fa = function (a, b) {
    this.type = a;
    this.progress = b;
  };
  Fa.__name__ = !0;
  Fa.__super__ = Y;
  Fa.prototype = D(Y.prototype, { __class__: Fa });
  var Ha = function (a, b, c, d, e) {
    null == e && (e = 0);
    this.type = a;
    this.target = b;
    this.x = c;
    this.y = d;
    this.which = e;
  };
  Ha.__name__ = !0;
  Ha.__super__ = Y;
  Ha.prototype = D(Y.prototype, { __class__: Ha });
  var fb = function (a, b) {
    this.type = a;
    this.surface = b;
  };
  fb.__name__ = !0;
  fb.__super__ = Y;
  fb.prototype = D(Y.prototype, { __class__: fb });
  var Q = function (a, b) {
    this.x = a;
    this.y = b;
  };
  Q.__name__ = !0;
  Q.dot = function (a, b) {
    return a.x * b.x + a.y * b.y;
  };
  Q.distance = function (a, b) {
    return Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
  };
  Q.prototype = {
    copy: function () {
      return new Q(this.x, this.y);
    },
    equals: function (a) {
      return null != a && a.x == this.x ? a.y == this.y : !1;
    },
    add: function (a) {
      return new Q(this.x + a.x, this.y + a.y);
    },
    subtract: function (a) {
      return new Q(this.x - a.x, this.y - a.y);
    },
    multiply: function (a) {
      return new Q(this.x * a.x, this.y * a.y);
    },
    divide: function (a) {
      return new Q(this.x / a.x, this.y / a.y);
    },
    __class__: Q
  };
  var z = function (a, b, c, d) {
    this.x = a;
    this.y = b;
    this.width = c;
    this.height = d;
  };
  z.__name__ = !0;
  z.combineMultiple = function (a) {
    for (var b = 0, c = 0, d = 0, e = 0, f = 0, m = a.length; f < m; ) {
      var k = f++,
        p = a[k];
      if (0 == k || p.get_top() < b) b = p.get_top();
      if (0 == k || p.get_left() < c) c = p.get_left();
      if (0 == k || p.get_bottom() > d) d = p.get_bottom();
      if (0 == k || p.get_right() > e) e = p.get_right();
    }
    return new z(c, b, e - c, d - b);
  };
  z.containingPoints = function (a) {
    for (var b = a[0].y, c = a[0].x, d = a[0].y, e = a[0].x, f = 0; f < a.length; ) {
      var m = a[f];
      ++f;
      m.y < b ? (b = m.y) : m.y > d && (d = m.y);
      m.x < c ? (c = m.x) : m.x > e && (e = m.x);
    }
    return new z(c, b, e - c, d - b);
  };
  z.prototype = {
    get_top: function () {
      return this.y;
    },
    set_top: function (a) {
      return (this.y = a);
    },
    get_left: function () {
      return this.x;
    },
    set_left: function (a) {
      return (this.x = a);
    },
    get_bottom: function () {
      return this.y + this.height;
    },
    set_bottom: function (a) {
      this.height = a - this.y;
      return a;
    },
    get_right: function () {
      return this.x + this.width;
    },
    set_right: function (a) {
      this.width = a - this.x;
      return a;
    },
    get_center: function () {
      return new Q((this.get_left() + this.get_right()) / 2, (this.get_top() + this.get_bottom()) / 2);
    },
    intersects: function (a) {
      return a.get_left() < this.get_right() && a.get_right() > this.get_left() && a.get_top() < this.get_bottom()
        ? a.get_bottom() > this.get_top()
        : !1;
    },
    contains: function (a) {
      return null != a && a.x >= this.x && a.y >= this.y && a.x < this.get_right() ? a.y < this.get_bottom() : !1;
    },
    equals: function (a) {
      return null != a && a.x == this.x && a.y == this.y && a.width == this.width ? a.height == this.height : !1;
    },
    combine: function (a) {
      var b = a.get_top() < this.get_top() ? a.get_top() : this.get_top(),
        c = a.get_left() < this.get_left() ? a.get_left() : this.get_left(),
        d = a.get_bottom() > this.get_bottom() ? a.get_bottom() : this.get_bottom();
      a = a.get_right() > this.get_right() ? a.get_right() : this.get_right();
      this.set_top(b);
      this.set_left(c);
      this.set_bottom(d);
      this.set_right(a);
    },
    copy: function () {
      return new z(this.x, this.y, this.width, this.height);
    },
    __class__: z
  };
  var qb = function (a) {
    this.mouseX = this.mouseY = 0;
    this.isFocused = !1;
    var b = this;
    this.listeners = new Ra();
    this.c = a;
    window.addEventListener("focus", T(this, this.onFocus));
    window.addEventListener("blur", T(this, this.onBlur));
    window.addEventListener("pagehide", T(this, this.onBlur));
    window.addEventListener("contextmenu", function (c) {
      var d = c.target.tagName.toLowerCase();
      if ("canvas" != d && "body" != d && "html" != d) return !0;
      b.onMouseUp(c);
      c.preventDefault();
      return !1;
    });
    window.addEventListener("click", T(this, this.onClick));
    window.addEventListener("mousedown", T(this, this.onMouseDown));
    window.addEventListener("mouseup", T(this, this.onMouseUp));
    window.addEventListener("mousemove", T(this, this.onMouseMove));
    window.addEventListener("mouseover", T(this, this.onMouseMove));
    window.addEventListener("keydown", T(this, this.onKeyDown));
    window.addEventListener("keyup", T(this, this.onKeyUp));
  };
  qb.__name__ = !0;
  qb.__super__ = Sa;
  qb.prototype = D(Sa.prototype, {
    set_mouseX: function (a) {
      return (this.mouseX = Math.floor(a));
    },
    set_mouseY: function (a) {
      return (this.mouseY = Math.floor(a));
    },
    updateMouse: function (a) {
      a = h.pageToGame(a.pageX, a.pageY);
      this.set_mouseX(a.x);
      this.set_mouseY(a.y);
    },
    onFocus: function () {
      this.isFocused = !0;
      this.triggerEvent(new Ta("focus"));
    },
    onBlur: function () {
      this.isFocused = !1;
      this.triggerEvent(new Ta("blur"));
    },
    onClick: function (a) {
      if (!this.isFocused) this.onFocus();
      this.updateMouse(a);
      this.triggerEvent(this.makeMouseEvent("click", a.which));
    },
    onMouseDown: function (a) {
      this.updateMouse(a);
      this.triggerEvent(this.makeMouseEvent("mouseDown", a.which));
    },
    onMouseUp: function (a) {
      this.updateMouse(a);
      this.triggerEvent(this.makeMouseEvent("mouseUp", a.which));
      3 == a.which &&
        (this.onKeyUp({ type: "keyup", keyCode: 16, preventDefault: function () {} }),
        this.onKeyUp({ type: "keyup", keyCode: 17, preventDefault: function () {} }));
    },
    onMouseMove: function (a) {
      this.updateMouse(a);
      this.triggerEvent(this.makeMouseEvent("move"));
    },
    makeMouseEvent: function (a, b) {
      null == b && (b = 0);
      return new Ha(a, null, this.mouseX, this.mouseY, b);
    },
    onKeyDown: function (a) {
      if (this.isFocused) {
        var b = window.document.activeElement.tagName.toLowerCase();
        "input" != b &&
          "textarea" != b &&
          (this.triggerEvent(new Ua("keyDown", a.keyCode)),
          this.captureKey(a.keyCode, a.ctrlKey) && a.preventDefault());
      }
    },
    onKeyUp: function (a) {
      if (this.isFocused) {
        var b = window.document.activeElement.tagName.toLowerCase();
        "input" != b &&
          "textarea" != b &&
          (this.triggerEvent(new Ua("keyUp", a.keyCode)), this.captureKey(a.keyCode, a.ctrlKey) && a.preventDefault());
      }
    },
    captureKey: function (a, b) {
      return !(
        (112 <= a && 123 >= a) ||
        (b && (48 == a || 96 == a || 187 == a || 107 == a || 189 == a || 109 == a || 84 == a))
      );
    },
    __class__: qb
  });
  var G = function () {};
  G.__name__ = !0;
  G._init = function () {
    G.inited ||
      (h.input.addEventListener("keyDown", G.onKeyDown),
      h.input.addEventListener("keyUp", G.onKeyUp),
      h.input.addEventListener("blur", G.reset),
      h.stage.addEventListener("exitFrame", G.update),
      (G.inited = !0));
  };
  G.onKeyDown = function (a) {
    G.keyDown(a.keyCode) || G.keys.push(a.keyCode);
  };
  G.onKeyUp = function (a) {
    a = G.keys.indexOf(a.keyCode);
    -1 < a && G.keys.splice(a, 1);
  };
  G.reset = function (a) {
    G.keys = [];
  };
  G.update = function () {
    G.keysOld = G.keys.slice(0);
    if (null != window.document.activeElement && null != window.document.activeElement.tagName) {
      var a = window.document.activeElement.tagName.toLowerCase();
      ("input" != a && "textarea" != a) || G.reset(null);
    }
  };
  G.keyDown = function (a) {
    return -1 < G.keys.indexOf(a);
  };
  G.keyDownOld = function (a) {
    return -1 < G.keysOld.indexOf(a);
  };
  G.keyPressed = function (a) {
    return G.keyDown(a) ? !G.keyDownOld(a) : !1;
  };
  G.keyReleased = function (a) {
    return G.keyDown(a) ? !1 : G.keyDownOld(a);
  };
  var Ga = function (a, b) {
    this.type = a;
    this.name = b;
  };
  Ga.__name__ = !0;
  Ga.callFunc = function (a, b) {
    var c = new Ga(Ga.FUNC, a);
    c.params = b;
    return c;
  };
  Ga.prototype = {
    execute: function (a) {
      this.type == Ga.FUNC && a[this.name].apply(a, this.params);
    },
    __class__: Ga
  };
  var Ea = function (a) {
    this._transform = new gb();
    this._ctx = a;
    this.reset();
  };
  Ea.__name__ = !0;
  Ea.prototype = {
    save: function () {
      this._transform.save();
      this._ctx.save();
    },
    restore: function () {
      this._transform.restore();
      this._ctx.restore();
    },
    setTransform: function (a, b, c, d, e, f) {
      this._transform.set(a, b, c, d, e, f);
      this._ctx.setTransform(a, b, c, d, e, f);
    },
    translate: function (a, b) {
      if (0 != a || 0 != b) (this._transform.translate(a, b), this._ctx.translate(a, b));
    },
    scale: function (a, b) {
      if (1 != a || 1 != b) (this._transform.scale(a, b), this._ctx.scale(a, b));
    },
    rotate: function (a) {
      0 != a && (this._transform.rotate(a), this._ctx.rotate(a));
    },
    get_skipDraw: function () {
      return this.filling ? !1 : !this.stroking;
    },
    get_strokeOffset: function () {
      return this.stroking && 0 != Math.round(this.strokeWidth) % 2 ? 0.5 : 0;
    },
    reset: function (a) {
      null == a && (a = !1);
      a || this.setTransform(1, 0, 0, 1, 0, 0);
      this.filling = this.stroking = !1;
    },
    clearRect: function (a, b, c, d) {
      this._ctx.clearRect(a, b, c, d);
    },
    beginFill: function (a, b) {
      null == b && (b = 1);
      null == a && (a = 0);
      0 > b ? (b = 0) : 1 < b && (b = 1);
      this._ctx.fillStyle = ya.getColorString(a & 16777215, b);
      this.filling = !0;
    },
    endFill: function () {
      this.filling = !1;
    },
    beginStroke: function (a, b, c) {
      null == c && (c = 1);
      null == b && (b = 0);
      null == a && (a = 1);
      0 > c ? (c = 0) : 1 < c && (c = 1);
      this._ctx.strokeStyle = ya.getColorString(b & 16777215, c);
      this._ctx.lineWidth = this.strokeWidth = a;
      this.stroking = !0;
    },
    endStroke: function () {
      this.stroking = !1;
    },
    drawRect: function (a, b, c, d) {
      if (!this.get_skipDraw()) {
        var e = this.get_strokeOffset();
        a += e;
        b += e;
        this.filling && this._ctx.fillRect(a, b, c, d);
        this.stroking && this._ctx.strokeRect(a, b, c, d);
      }
    },
    beginPath: function () {
      this._ctx.beginPath();
    },
    closePath: function () {
      this._ctx.closePath();
    },
    moveTo: function (a, b) {
      this._ctx.moveTo(a, b);
    },
    lineTo: function (a, b) {
      this._ctx.lineTo(a, b);
    },
    arc: function (a, b, c, d, e, f) {
      null == f && (f = !1);
      this._ctx.arc(a, b, c, d, e, f);
    },
    applyPath: function () {
      this.filling && this._ctx.fill();
      this.stroking && this._ctx.stroke();
    },
    drawPath: function (a, b) {
      null == b && (b = !0);
      if (!(this.get_skipDraw() || 2 > a.length)) {
        var c = this.get_strokeOffset();
        this.beginPath();
        this.moveTo(a[0].x + c, a[0].y + c);
        for (var d = 1, e = a.length; d < e; ) {
          var f = d++;
          this.lineTo(a[f].x + c, a[f].y + c);
        }
        b && this.closePath();
        this.applyPath();
      }
    },
    drawCircle: function (a, b, c) {
      if (!this.get_skipDraw()) {
        var d = this.get_strokeOffset();
        a += d;
        b += d;
        this.beginPath();
        this.arc(a, b, c, 0.1, Ea.PI2 + 0.1);
        this.applyPath();
      }
    },
    drawArc: function (a, b, c, d, e, f, m) {
      null == m && (m = !1);
      null == f && (f = !1);
      if (!this.get_skipDraw()) {
        var k = this.get_strokeOffset();
        a += k;
        b += k;
        this.beginPath();
        m && this.moveTo(a, b);
        this.arc(a, b, c, d, e, f);
        this.applyPath();
      }
    },
    drawEllipse: function (a, b, c, d) {
      if (!this.get_skipDraw()) {
        var e = this.get_strokeOffset();
        a += e;
        b += e;
        this.beginPath();
        this.save();
        this.translate(a + c / 2, b + d / 2);
        this.scale(c / d, 1);
        this.arc(0, 0, d / 2, 0.1, Ea.PI2 + 0.1);
        this.restore();
        this.applyPath();
      }
    },
    drawImage: function (a, b, c, d, e) {
      null == e && (e = !0);
      null != b
        ? e
          ? ya.drawImageSafe(this._ctx, a, b.x, b.y, b.width, b.height, c, d)
          : this._ctx.drawImage(a, b.x, b.y, b.width, b.height, c, d, b.width, b.height)
        : this._ctx.drawImage(a, c, d);
    },
    drawText: function (a, b, c, d, e, f, m, k) {
      null == k && (k = 1.25);
      null == m && (m = "left");
      null == f && (f = "normal");
      if (!this.get_skipDraw())
        for (
          d = ("normal" != f ? f + " " : "") + e + "px " + d,
            this._ctx.font != d && (this._ctx.font = d),
            this._ctx.textBaseline = "top",
            this._ctx.textAlign = m,
            a = a.split("\n"),
            m = 0,
            d = a.length;
          m < d;
        ) {
          f = m++;
          var p = a[f];
          this.filling && this._ctx.fillText(p, b, c + f * e * k);
          this.stroking && this._ctx.strokeText(p, b, c + f * e * k);
        }
    },
    getTextWidth: function (a, b, c) {
      b = c + "px " + b;
      this._ctx.font != b && (this._ctx.font = b);
      a = a.split("\n");
      c = b = 0;
      for (var d = a.length; c < d; ) {
        var e = c++;
        e = this._ctx.measureText(a[e]).width;
        e > b && (b = e);
      }
      return b;
    },
    __class__: Ea
  };
  var gb = function () {
    this.states = [];
    this.matrix = [1, 0, 0, 1, 0, 0];
  };
  gb.__name__ = !0;
  gb.prototype = {
    getMatrix: function () {
      return this.matrix.slice(0);
    },
    get: function (a) {
      return 0 > a || 5 < a ? 0 : this.matrix[a];
    },
    set: function (a, b, c, d, e, f) {
      this.matrix[0] = a;
      this.matrix[1] = b;
      this.matrix[2] = c;
      this.matrix[3] = d;
      this.matrix[4] = e;
      this.matrix[5] = f;
    },
    multiply: function (a, b, c, d, e, f) {
      this.set(
        this.matrix[0] * a + this.matrix[2] * b,
        this.matrix[1] * a + this.matrix[3] * b,
        this.matrix[0] * c + this.matrix[2] * d,
        this.matrix[1] * c + this.matrix[3] * d,
        this.matrix[0] * e + this.matrix[2] * f + this.matrix[4],
        this.matrix[1] * e + this.matrix[3] * f + this.matrix[5]
      );
    },
    identity: function () {
      this.set(1, 0, 0, 1, 0, 0);
    },
    translate: function (a, b) {
      (0 == a && 0 == b) || this.multiply(1, 0, 0, 1, a, b);
    },
    scale: function (a, b) {
      (1 == a && 1 == b) || this.multiply(a, 0, 0, b, 0, 0);
    },
    rotate: function (a) {
      0 != a && this.multiply(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0);
    },
    save: function () {
      this.states.push(this.matrix.slice(0));
    },
    restore: function () {
      var a = this.states.pop();
      null != a ? (this.matrix = a) : this.identity();
    },
    equals: function (a) {
      return this.matrix[0] == a.get(0) &&
        this.matrix[1] == a.get(1) &&
        this.matrix[2] == a.get(2) &&
        this.matrix[3] == a.get(3) &&
        this.matrix[4] == a.get(4)
        ? this.matrix[5] == a.get(5)
        : !1;
    },
    copy: function (a) {
      this.matrix[0] = a.get(0);
      this.matrix[1] = a.get(1);
      this.matrix[2] = a.get(2);
      this.matrix[3] = a.get(3);
      this.matrix[4] = a.get(4);
      this.matrix[5] = a.get(5);
    },
    apply: function (a, b) {
      return new Q(
        this.matrix[0] * a + this.matrix[2] * b + this.matrix[4],
        this.matrix[1] * a + this.matrix[3] * b + this.matrix[5]
      );
    },
    __class__: gb
  };
  var lc = function () {};
  lc.__name__ = !0;
  var za = function (a) {
    this.length = a.byteLength;
    this.b = new ec(a);
    this.b.bufferValue = a;
    a.hxBytes = this;
    a.bytes = this.b;
  };
  za.__name__ = !0;
  za.ofString = function (a) {
    for (var b = [], c = 0; c < a.length; ) {
      var d = a.charCodeAt(c++);
      55296 <= d && 56319 >= d && (d = ((d - 55232) << 10) | (a.charCodeAt(c++) & 1023));
      127 >= d
        ? b.push(d)
        : (2047 >= d
            ? b.push(192 | (d >> 6))
            : (65535 >= d ? b.push(224 | (d >> 12)) : (b.push(240 | (d >> 18)), b.push(128 | ((d >> 12) & 63))),
              b.push(128 | ((d >> 6) & 63))),
          b.push(128 | (d & 63)));
    }
    return new za(new ec(b).buffer);
  };
  za.prototype = {
    getString: function (a, b) {
      if (0 > a || 0 > b || a + b > this.length) throw new Z(oa.OutsideBounds);
      for (var c = "", d = this.b, e = String.fromCharCode, f = a, m = a + b; f < m; ) {
        var k = d[f++];
        if (128 > k) {
          if (0 == k) break;
          c += e(k);
        } else if (224 > k) c += e(((k & 63) << 6) | (d[f++] & 127));
        else if (240 > k) {
          var p = d[f++];
          c += e(((k & 31) << 12) | ((p & 127) << 6) | (d[f++] & 127));
        } else {
          p = d[f++];
          var y = d[f++];
          k = ((k & 15) << 18) | ((p & 127) << 12) | ((y & 127) << 6) | (d[f++] & 127);
          c += e((k >> 10) + 55232);
          c += e((k & 1023) | 56320);
        }
      }
      return c;
    },
    toString: function () {
      return this.getString(0, this.length);
    },
    __class__: za
  };
  var ra = function () {};
  ra.__name__ = !0;
  ra.encode = function (a, b) {
    null == b && (b = !0);
    var c = new sb(ra.BYTES).encodeBytes(a).toString();
    if (b)
      switch (a.length % 3) {
        case 1:
          c += "==";
          break;
        case 2:
          c += "=";
      }
    return c;
  };
  ra.decode = function (a, b) {
    null == b && (b = !0);
    if (b) for (; 61 == ja.cca(a, a.length - 1); ) a = ja.substr(a, 0, -1);
    return new sb(ra.BYTES).decodeBytes(za.ofString(a));
  };
  var sb = function (a) {
    for (var b = a.length, c = 1; b > 1 << c; ) ++c;
    if (8 < c || b != 1 << c) throw new Z("BaseCode : base length must be a power of two.");
    this.base = a;
    this.nbits = c;
  };
  sb.__name__ = !0;
  sb.prototype = {
    encodeBytes: function (a) {
      for (
        var b = this.nbits,
          c = this.base,
          d = ((8 * a.length) / b) | 0,
          e = new za(new tb(d + (0 == (8 * a.length) % b ? 0 : 1))),
          f = 0,
          m = 0,
          k = (1 << b) - 1,
          p = 0,
          y = 0;
        y < d;
      ) {
        for (; m < b; ) ((m += 8), (f <<= 8), (f |= a.b[p++]));
        m -= b;
        e.b[y++] = c.b[(f >> m) & k] & 255;
      }
      0 < m && (e.b[y++] = c.b[(f << (b - m)) & k] & 255);
      return e;
    },
    initTable: function () {
      for (var a = [], b = 0; 256 > b; ) {
        var c = b++;
        a[c] = -1;
      }
      b = 0;
      for (c = this.base.length; b < c; ) {
        var d = b++;
        a[this.base.b[d]] = d;
      }
      this.tbl = a;
    },
    decodeBytes: function (a) {
      var b = this.nbits;
      null == this.tbl && this.initTable();
      for (var c = this.tbl, d = (a.length * b) >> 3, e = new za(new tb(d)), f = 0, m = 0, k = 0, p = 0; p < d; ) {
        for (; 8 > m; ) {
          m += b;
          f <<= b;
          var y = c[a.b[k++]];
          if (-1 == y) throw new Z("BaseCode : invalid encoded char");
          f |= y;
        }
        m -= 8;
        e.b[p++] = (f >> m) & 255;
      }
      return e;
    },
    __class__: sb
  };
  var hb = function () {
    this.h = {};
  };
  hb.__name__ = !0;
  hb.__interfaces__ = [lc];
  hb.prototype = {
    keys: function () {
      var a = [],
        b;
      for (b in this.h) this.h.hasOwnProperty(b) && a.push(b | 0);
      return ja.iter(a);
    },
    iterator: function () {
      return {
        ref: this.h,
        it: this.keys(),
        hasNext: function () {
          return this.it.hasNext();
        },
        next: function () {
          var a = this.it.next();
          return this.ref[a];
        }
      };
    },
    __class__: hb
  };
  var fc = function (a, b) {
    this.map = a;
    this.keys = b;
    this.index = 0;
    this.count = b.length;
  };
  fc.__name__ = !0;
  fc.prototype = {
    hasNext: function () {
      return this.index < this.count;
    },
    next: function () {
      var a = this.map,
        b = this.keys[this.index++];
      return null != na[b] ? a.getReserved(b) : a.h[b];
    },
    __class__: fc
  };
  var Ra = function () {
    this.h = {};
  };
  Ra.__name__ = !0;
  Ra.__interfaces__ = [lc];
  Ra.prototype = {
    setReserved: function (a, b) {
      null == this.rh && (this.rh = {});
      this.rh["$" + a] = b;
    },
    getReserved: function (a) {
      return null == this.rh ? null : this.rh["$" + a];
    },
    existsReserved: function (a) {
      return null == this.rh ? !1 : this.rh.hasOwnProperty("$" + a);
    },
    remove: function (a) {
      if (null != na[a]) {
        a = "$" + a;
        if (null == this.rh || !this.rh.hasOwnProperty(a)) return !1;
        delete this.rh[a];
      } else {
        if (!this.h.hasOwnProperty(a)) return !1;
        delete this.h[a];
      }
      return !0;
    },
    arrayKeys: function () {
      var a = [],
        b;
      for (b in this.h) this.h.hasOwnProperty(b) && a.push(b);
      if (null != this.rh) for (b in this.rh) 36 == b.charCodeAt(0) && a.push(b.substr(1));
      return a;
    },
    __class__: Ra
  };
  var oa = {
    __ename__: !0,
    __constructs__: ["Blocked", "Overflow", "OutsideBounds", "Custom"],
    Blocked: ["Blocked", 0]
  };
  oa.Blocked.toString = dc;
  oa.Blocked.__enum__ = oa;
  oa.Overflow = ["Overflow", 1];
  oa.Overflow.toString = dc;
  oa.Overflow.__enum__ = oa;
  oa.OutsideBounds = ["OutsideBounds", 2];
  oa.OutsideBounds.toString = dc;
  oa.OutsideBounds.__enum__ = oa;
  oa.Custom = function (a) {
    a = ["Custom", 3, a];
    a.__enum__ = oa;
    a.toString = dc;
    return a;
  };
  var Z = function (a) {
    Error.call(this);
    this.val = a;
    this.message = String(a);
    Error.captureStackTrace && Error.captureStackTrace(this, Z);
  };
  Z.__name__ = !0;
  Z.wrap = function (a) {
    return a instanceof Error ? a : new Z(a);
  };
  Z.__super__ = Error;
  Z.prototype = D(Error.prototype, { __class__: Z });
  var E = function () {};
  E.__name__ = !0;
  E.getClass = function (a) {
    if (a instanceof Array && null == a.__enum__) return Array;
    var b = a.__class__;
    if (null != b) return b;
    a = E.__nativeClassName(a);
    return null != a ? E.__resolveNativeClass(a) : null;
  };
  E.__string_rec = function (a, b) {
    if (null == a) return "null";
    if (5 <= b.length) return "<...>";
    var c = typeof a;
    "function" == c && (a.__name__ || a.__ename__) && (c = "object");
    switch (c) {
      case "function":
        return "<function>";
      case "object":
        if (a instanceof Array) {
          if (a.__enum__) {
            if (2 == a.length) return a[0];
            c = a[0] + "(";
            b += "\t";
            for (var d = 2, e = a.length; d < e; ) {
              var f = d++;
              c = 2 != f ? c + ("," + E.__string_rec(a[f], b)) : c + E.__string_rec(a[f], b);
            }
            return c + ")";
          }
          c = a.length;
          d = "[";
          b += "\t";
          for (e = 0; e < c; ) ((f = e++), (d += (0 < f ? "," : "") + E.__string_rec(a[f], b)));
          return d + "]";
        }
        try {
          d = a.toString;
        } catch (m) {
          return "???";
        }
        if (null != d && d != Object.toString && "function" == typeof d && ((c = a.toString()), "[object Object]" != c))
          return c;
        c = null;
        d = "{\n";
        b += "\t";
        e = null != a.hasOwnProperty;
        for (c in a)
          (e && !a.hasOwnProperty(c)) ||
            "prototype" == c ||
            "__class__" == c ||
            "__super__" == c ||
            "__interfaces__" == c ||
            "__properties__" == c ||
            (2 != d.length && (d += ", \n"), (d += b + c + " : " + E.__string_rec(a[c], b)));
        b = b.substring(1);
        return d + ("\n" + b + "}");
      case "string":
        return a;
      default:
        return String(a);
    }
  };
  E.__interfLoop = function (a, b) {
    if (null == a) return !1;
    if (a == b) return !0;
    var c = a.__interfaces__;
    if (null != c)
      for (var d = 0, e = c.length; d < e; ) {
        var f = d++;
        f = c[f];
        if (f == b || E.__interfLoop(f, b)) return !0;
      }
    return E.__interfLoop(a.__super__, b);
  };
  E.__instanceof = function (a, b) {
    if (null == b) return !1;
    switch (b) {
      case Array:
        return a instanceof Array ? null == a.__enum__ : !1;
      case mc:
        return "boolean" == typeof a;
      case qc:
        return !0;
      case kc:
        return "number" == typeof a;
      case rc:
        return "number" == typeof a ? (a | 0) === a : !1;
      case String:
        return "string" == typeof a;
      default:
        if (null != a)
          if ("function" == typeof b) {
            if (a instanceof b || E.__interfLoop(E.getClass(a), b)) return !0;
          } else {
            if ("object" == typeof b && E.__isNativeObj(b) && a instanceof b) return !0;
          }
        else return !1;
        return (b == sc && null != a.__name__) || (b == tc && null != a.__ename__) ? !0 : a.__enum__ == b;
    }
  };
  E.__cast = function (a, b) {
    if (E.__instanceof(a, b)) return a;
    throw new Z("Cannot cast " + la.string(a) + " to " + la.string(b));
  };
  E.__nativeClassName = function (a) {
    a = E.__toStr.call(a).slice(8, -1);
    return "Object" == a || "Function" == a || "Math" == a || "JSON" == a ? null : a;
  };
  E.__isNativeObj = function (a) {
    return null != E.__nativeClassName(a);
  };
  E.__resolveNativeClass = function (a) {
    return jc[a];
  };
  var xa = function (a) {
    if (a instanceof Array && null == a.__enum__) ((this.a = a), (this.byteLength = a.length));
    else {
      this.a = [];
      for (var b = 0; b < a; ) {
        var c = b++;
        this.a[c] = 0;
      }
      this.byteLength = a;
    }
  };
  xa.__name__ = !0;
  xa.sliceImpl = function (a, b) {
    var c = new ec(this, a, null == b ? null : b - a),
      d = new tb(c.byteLength);
    new ec(d).set(c);
    return d;
  };
  xa.prototype = {
    slice: function (a, b) {
      return new xa(this.a.slice(a, b));
    },
    __class__: xa
  };
  var Ia = function () {};
  Ia.__name__ = !0;
  Ia._new = function (a, b, c) {
    if ("number" == typeof a) {
      c = [];
      for (b = 0; b < a; ) {
        var d = b++;
        c[d] = 0;
      }
      c.byteLength = c.length;
      c.byteOffset = 0;
      c.buffer = new xa(c);
    } else if (E.__instanceof(a, xa))
      (null == b && (b = 0),
        null == c && (c = a.byteLength - b),
        (c = 0 == b ? a.a : a.a.slice(b, b + c)),
        (c.byteLength = c.length),
        (c.byteOffset = b),
        (c.buffer = a));
    else if (a instanceof Array && null == a.__enum__)
      ((c = a.slice()), (c.byteLength = c.length), (c.byteOffset = 0), (c.buffer = new xa(c)));
    else throw new Z("TODO " + la.string(a));
    c.subarray = Ia._subarray;
    c.set = Ia._set;
    return c;
  };
  Ia._set = function (a, b) {
    if (E.__instanceof(a.buffer, xa)) {
      if (a.byteLength + b > this.byteLength) throw new Z("set() outside of range");
      for (var c = 0, d = a.byteLength; c < d; ) {
        var e = c++;
        this[e + b] = a[e];
      }
    } else if (a instanceof Array && null == a.__enum__) {
      if (a.length + b > this.byteLength) throw new Z("set() outside of range");
      c = 0;
      for (d = a.length; c < d; ) ((e = c++), (this[e + b] = a[e]));
    } else throw new Z("TODO");
  };
  Ia._subarray = function (a, b) {
    var c = Ia._new(this.slice(a, b));
    c.byteOffset = a;
    return c;
  };
  var n = function () {};
  n.__name__ = !0;
  var q = function () {};
  q.__name__ = !0;
  var gc = function (a, b, c, d) {
    null == d && (d = 0);
    null == c && (c = 1);
    var e = this;
    this.image = t.loadImage(a);
    this.colorOffset = d;
    t.loadTextFile(b, function (f) {
      f = JSON.parse(f);
      e.lineHeight = f.l * c;
      f = f.c;
      e.chars = [];
      for (var m = 0; m < f.length; ) {
        var k = f[m];
        ++m;
        k.x *= c;
        k.y *= c;
        k.w *= c;
        k.h *= c;
        k.xo *= c;
        k.yo *= c;
        k.xa *= c;
        e.chars[k.c] = k;
      }
    });
  };
  gc.__name__ = !0;
  gc.prototype = { __class__: gc };
  var g = function () {
    this.muteMusic =
      this.muteSFX =
      this.ieMenu =
      this.ieGame1 =
      this.ieGame2 =
      this.ieSurface =
      this.ieUnmuted =
      this.invert =
        !1;
    this.fader = new x();
    this.fading = this.fadingSlow = !1;
    this.timerHolder = new x();
    this.pauseOnInit = !1;
    this.pausedTime = 0;
    this.hasPaused = this.paused = !1;
    x.call(this);
  };
  g.__name__ = !0;
  g.main = function () {
    var a = window.location.hostname;
    if ("localhost" != a) {
      for (var b = [ra.decode("YXJtb3JnYW1lcy5jb20=").toString()], c = !1, d = 0; d < b.length; ) {
        var e = b[d];
        ++d;
        if (a == e) {
          c = !0;
          break;
        } else {
          e = "." + e;
          var f = a.lastIndexOf(e);
          if (-1 != f && f == a.length - e.length) {
            c = !0;
            break;
          }
        }
      }
      c || (window[ra.decode("bG9jYXRpb24=").toString()][ra.decode("aHJlZg==").toString()] = window[ra.decode("bG9jYXRpb24=").toString()][ra.decode("aHJlZg==").toString()]);
    }
    g.i = new g();
    g.i.addEventListener("added", ((Ja = g.i), T(Ja, Ja.init)));
    h.start((g.element = window.document.getElementById("game")), 504, 504, 2105376, !1, g.i);
  };
  g.smootherStep = function (a) {
    return a * a * a * (a * (6 * a - 15) + 10);
  };
  g.quantize = function (a) {
    return Math.floor(a / n.tileSize);
  };
  g.getInputX = function () {
    return (G.keyDown(37) || G.keyDown(65) ? -1 : 0) + (G.keyDown(39) || G.keyDown(68) ? 1 : 0);
  };
  g.getInputY = function () {
    return (G.keyDown(38) || G.keyDown(87) ? -1 : 0) + (G.keyDown(40) || G.keyDown(83) ? 1 : 0);
  };
  g.formatMS = function (a) {
    var b = "";
    a = Math.round(a);
    var c = Math.floor(a / 1e3),
      d = Math.floor(c / 60),
      e = Math.floor(d / 60);
    0 < e && (b += e + ":");
    d %= 60;
    10 > d && (b += "0");
    b = b + d + ":";
    c %= 60;
    10 > c && (b += "0");
    b = b + c + ":";
    a %= 1e3;
    100 > a && (b += "0");
    10 > a && (b += "0");
    return (b += a);
  };
  g.__super__ = x;
  g.prototype = D(x.prototype, {
    get_gameTimeMS: function () {
      return this.paused ? this.pauseStart - this.pausedTime : O.get_currentMS() - this.pausedTime;
    },
    get_gameTime: function () {
      return 0.001 * this.get_gameTimeMS();
    },
    init: function (a) {
      this.removeEventListener("added", T(this, this.init));
      h.set_imageSmoothingEnabled(!1);
      t.addEventListener("finished", T(this, this.loaded));
    },
    loaded: function (a) {
      var b = this;
      g.nosave = !sa.test();
      g.nosave || this.loadProgress();
      a = (function () {
        var c = -1,
          d = window.navigator.userAgent,
          e = d.indexOf("MSIE "),
          f = d.indexOf("Trident/");
        0 < e
          ? (c = parseInt(d.substring(e + 5, d.indexOf(".", e)), 10))
          : 0 < f && ((c = d.indexOf("rv:")), (c = parseInt(d.substring(c + 3, d.indexOf(".", c)), 10)));
        return -1 < c ? c : void 0;
      })();
      g.ie = 0 < a && 11 >= a;
      g.ie && (this.muteSFX = this.muteMusic = !0);
      this.lastTick = O.get_currentMS();
      this.addEventListener("enterFrame", T(this, this.update));
      window.document.getElementById("game").style.display = "block";
      window.document.getElementById("loader").style.display = "none";
      this.pauseMenu = new ub();
      this.addChild(this.pauseMenu);
      this.fader.mouseEnabled = !0;
      this.addChild(this.fader);
      this.addChild(this.timerHolder);
      v.setup(this);
      h.input.addEventListener("blur", function (c) {
        null != b.targetScreen && b.targetScreen.pausable && (b.pauseOnInit = !0);
        null != b.currentScreen && b.currentScreen.pausable && b.pause();
      });
      this.changeScreen(new vb(), !1);
    },
    pause: function (a) {
      null == a && (a = !0);
      this.paused ||
        (a && null != this.targetScreen && this.targetScreen.pausable
          ? (this.pauseOnInit = !0)
          : ((this.paused = !0),
            (this.pauseStart = O.get_currentMS()),
            null != this.pauseMenu && ((this.pauseMenu.visible = !0), this.pauseMenu.onPause()),
            (this.hasPaused = !0),
            E.__instanceof(this.currentScreen, w) &&
              null != w.i.pauseText &&
              (w.i.pauseText.parent.removeChild(w.i.pauseText), (w.i.pauseText = null))));
    },
    unpause: function () {
      this.paused &&
        null == this.targetScreen &&
        ((this.paused = !1), (this.pausedTime += O.get_currentMS() - this.pauseStart), (this.pauseMenu.visible = !1));
    },
    getFadeSpeed: function () {
      return this.fadingSlow ? n.screenFadeTimeSlow : n.screenFadeTime;
    },
    changeScreen: function (a, b, c, d, e) {
      null == e && (e = !1);
      null == d && (d = !1);
      null == b && (b = !0);
      this.screenCallback = c;
      b
        ? null == this.targetScreen &&
          ((this.fading = !0),
          (this.fadingSlow = d),
          (this.fadeStart = O.get_currentMS()),
          this.fader.graphics.clear(),
          this.fader.graphics.beginFill(e ? 16777215 : 1052688),
          this.fader.graphics.drawRect(0, 0, h.width, h.height),
          (this.fader.mouseEnabled = !0),
          null == this.currentScreen
            ? (this.fader.set_alpha(1), (this.fadeStart -= this.getFadeSpeed() / 2), this.setScreen(a))
            : ((this.targetScreen = a), this.currentScreen.prekill()))
        : ((this.fading = !1),
          this.fader.set_alpha(0),
          (this.fader.mouseEnabled = !1),
          null != this.currentScreen && this.currentScreen.prekill(),
          (this.targetScreen = null),
          this.setScreen(a),
          this.currentScreen.ready());
    },
    setScreen: function (a) {
      null != this.currentScreen && (this.currentScreen.kill(), this.removeChild(this.currentScreen));
      this.currentScreen = a;
      this.addChildAt(this.currentScreen, 0);
      this.currentScreen.init();
      null != this.screenCallback && this.screenCallback();
      this.screenCallback = null;
      this.currentScreen.pausable ? this.pauseOnInit && this.pause(!1) : this.unpause();
      this.pauseOnInit = !1;
    },
    update: function (a) {
      null != this.targetScreen
        ? ((a = Math.min((O.get_currentMS() - this.fadeStart) / (this.getFadeSpeed() / 2), 1)),
          this.fader.set_alpha(g.smootherStep(a)),
          1 == a && ((a = this.targetScreen), (this.targetScreen = null), this.setScreen(a)))
        : 0 < this.fader.alpha &&
          ((a = Math.min((O.get_currentMS() - this.fadeStart) / (this.getFadeSpeed() / 2) - 1, 1)),
          this.fader.set_alpha(1 - g.smootherStep(a)),
          1 == a && ((this.fading = this.fader.mouseEnabled = !1), this.currentScreen.ready()));
      null != this.currentScreen &&
        this.currentScreen.pausable &&
        (G.keyPressed(80) || G.keyPressed(27)) &&
        (this.paused ? this.unpause() : this.pause());
      if (!this.paused) {
        null != this.currentScreen && this.currentScreen.update();
        for (a = 0; this.get_gameTimeMS() - this.lastTick >= n.tickMS; )
          if (
            ((this.lastTick += n.tickMS), null != this.currentScreen && this.currentScreen.tick(), ++a, a == n.ticksMax)
          ) {
            this.lastTick = this.get_gameTimeMS();
            break;
          }
        null != this.currentScreen && this.currentScreen.postUpdate();
      }
      v.update();
    },
    migrateProgress: function () {
      try {
        if (null != JSON.parse(window.atob(sa.getItem("lws:rotate")))) return;
      } catch (k) {}
      try {
        var a = JSON.parse(window.atob(sa.getItem("data"))),
          b = a.unlocked;
        if (
          "number" == typeof b &&
          (b | 0) === b &&
          0 <= a.unlocked &&
          a.unlocked < B.list.length &&
          a.awards instanceof Array &&
          null == a.awards.__enum__ &&
          a.awards.length == v.all.length
        )
          if (null != a.best) {
            var c = a.best;
            var d = "number" == typeof c && (c | 0) === c ? -1 < a.best : !1;
          } else d = !0;
        else d = !1;
        if (
          d &&
          (null != a.invert ? "boolean" == typeof a.invert && 1 == a.invert : 1) &&
          (null != a.muteMusic ? "boolean" == typeof a.muteMusic && 1 == a.muteMusic : 1) &&
          (null != a.muteSFX ? "boolean" == typeof a.muteSFX && 1 == a.muteSFX : 1)
        ) {
          d = 0;
          for (var e = v.all.length; d < e; ) {
            var f = d++;
            if ("boolean" != typeof a.awards[f]) throw Error();
          }
          var m = { unlocked: a.unlocked, awards: a.awards };
          null != a.best && (m.best = a.best);
          null != a.invert && (m.invert = a.invert);
          null != a.muteMusic && (m.muteMusic = a.muteMusic);
          null != a.muteSFX && (m.muteSFX = a.muteSFX);
          sa.setItem("lws:rotate", window.btoa(JSON.stringify(m)));
          sa.removeItem("data");
        }
      } catch (k) {}
    },
    loadProgress: function () {
      this.migrateProgress();
      try {
        var a = sa.getItem("lws:rotate");
        if (null != a && "" != a) {
          var b = JSON.parse(ra.decode(a).toString());
          if (null != b) {
            b.muteMusic && this.toggleMusic(!1);
            b.muteSFX && this.toggleSFX(!1);
            null != b.unlocked && (B.unlocked = b.unlocked);
            if (null != b.awards && b.awards instanceof Array && null == b.awards.__enum__) {
              var c = b.awards;
              a = 0;
              for (var d = c.length; a < d; ) {
                var e = a++;
                c[e] && (v.all[e].unlocked = !0);
              }
            }
            null != b.best && (B.speedrunBest = b.best);
            null != b.invert && (this.invert = 1 == b.invert);
          }
        }
      } catch (f) {
        (f instanceof Z && (f = f.val), console.log(f));
      }
    },
    saveProgress: function () {
      for (var a = [], b = 0, c = v.all; b < c.length; ) {
        var d = c[b];
        ++b;
        a.push(d.unlocked);
      }
      a = { unlocked: B.unlocked, awards: a };
      -1 < B.speedrunBest && (a.best = B.speedrunBest);
      this.invert && (a.invert = !0);
      this.muteMusic && (a.muteMusic = !0);
      this.muteSFX && (a.muteSFX = !0);
      sa.setItem("lws:rotate", ra.encode(za.ofString(JSON.stringify(a))));
    },
    clearProgress: function () {
      sa.removeItem("lws:rotate");
      for (var a = 0, b = v.all; a < b.length; ) {
        var c = b[a];
        ++a;
        c.unlocked = !1;
      }
      B.unlocked = 0;
      B.speedrunBest = -1;
      this.invert = !1;
    },
    warnNoSave: function (a) {
      if (g.nosave) {
        var b = new r(g.fontMain, "Enable cookies & site data\nto save your progress!", 2);
        b.set_x(8);
        b.set_y(4);
        b.set_scaleX(b.set_scaleY(0.5));
        a.addChild(b);
      }
    },
    toggleSFX: function (a) {
      null == a && (a = !0);
      this.muteSFX = !this.muteSFX;
      if (g.ie) {
        if (this.muteSFX)
          for (var b = 0, c = u.SFX; b < c.length; ) {
            var d = c[b];
            ++b;
            d.stop();
          }
      } else for (b = 0, c = u.SFX; b < c.length; ) ((d = c[b]), ++b, d.mute(this.muteSFX));
      g.ie
        ? this.muteMusic &&
          (this.muteSFX ? u.surface.stop() : this.ieSurface && !u.surface.playing() && u.surface.play())
        : u.surface.mute(this.muteSFX && this.muteMusic);
      a && this.saveProgress();
    },
    toggleMusic: function (a) {
      null == a && (a = !0);
      this.muteMusic = !this.muteMusic;
      g.ie
        ? this.muteMusic
          ? (u.themeMenu.stop(), u.themeGame1.stop(), u.themeGame2.stop())
          : (g.i.ieMenu && !u.themeMenu.playing() && u.themeMenu.play(),
            g.i.ieGame1 && !u.themeGame1.playing() && u.themeGame1.play(),
            g.i.ieGame2 && !u.themeGame2.playing() && u.themeGame2.play())
        : (u.themeMenu.mute(this.muteMusic), u.themeGame1.mute(this.muteMusic), u.themeGame2.mute(this.muteMusic));
      g.ie
        ? this.muteSFX &&
          (this.muteMusic ? u.surface.stop() : g.i.ieSurface && !u.surface.playing() && u.surface.play())
        : u.surface.mute(this.muteMusic && this.muteSFX);
      a && this.saveProgress();
    },
    __class__: g
  });
  var u = function () {};
  u.__name__ = !0;
  var sa = function () {};
  sa.__name__ = !0;
  sa.getItem = function (a) {
    try {
      return window.localStorage.getItem(a);
    } catch (b) {
      b instanceof Z && (b = b.val);
      if ("SecurityError" != b.name && "DOMException" != b.name) throw Z.wrap(b);
      return null;
    }
  };
  sa.setItem = function (a, b) {
    try {
      window.localStorage.setItem(a, b);
    } catch (c) {
      if ((c instanceof Z && (c = c.val), "SecurityError" != c.name && "DOMException" != c.name)) throw Z.wrap(c);
    }
  };
  sa.removeItem = function (a) {
    try {
      window.localStorage.removeItem(a);
    } catch (b) {
      if ((b instanceof Z && (b = b.val), "SecurityError" != b.name && "DOMException" != b.name)) throw Z.wrap(b);
    }
  };
  sa.test = function () {
    try {
      window.localStorage.setItem("?", "!");
      if ("!" != window.localStorage.getItem("?")) return !1;
      window.localStorage.removeItem("?");
      return !0;
    } catch (a) {
      a instanceof Z && (a = a.val);
      if ("SecurityError" != a.name && "DOMException" != a.name) throw Z.wrap(a);
      return !1;
    }
  };
  var Ka = function (a, b) {
    this.unlocked = !1;
    this.name = a;
    this.icon = b;
  };
  Ka.__name__ = !0;
  Ka.prototype = {
    unlock: function () {
      if (this.unlocked) return !1;
      this.unlocked = !0;
      g.i.saveProgress();
      E.__instanceof(g.i.currentScreen, ib) && g.i.currentScreen.refresh();
      v.queueNotify(this);
      return !0;
    },
    __class__: Ka
  };
  var v = function () {};
  v.__name__ = !0;
  v.setup = function (a) {
    null == v.bubble &&
      ((v.bubble = new x()),
      (v.bubble.mouseEnabled = !0),
      a.addChild(v.bubble),
      (v.bubbleTitle = new r(g.fontMain, "NEW AWARD")),
      v.bubbleTitle.set_x(68),
      v.bubbleTitle.set_y(4),
      v.bubbleTitle.set_alpha(0.5),
      v.bubble.addChild(v.bubbleTitle),
      (v.bubbleName = new r(g.fontMain, "")),
      v.bubbleName.set_x(68),
      v.bubbleName.set_y(28),
      v.bubble.addChild(v.bubbleName),
      v.bubble.set_alpha(0));
  };
  v.queueNotify = function (a) {
    null == v.queue && (v.queue = []);
    null != a && 0 > v.queue.indexOf(a) && v.queue.push(a);
  };
  v.adjustBubble = function (a, b) {
    v.bubbleName.set_text(ma.replace(a, "\n", " "));
    v.bubble.graphics.clear();
    var c = Math.max(v.bubbleTitle.get_width(), v.bubbleName.get_width()) + v.bubbleName.x + 12 + 4;
    v.bubble.graphics.beginFill(3158064);
    v.bubble.graphics.drawRect(0, 0, c, 68);
    v.bubble.graphics.beginFill(6316128);
    v.bubble.graphics.drawRect(0, 0, c - 2, 66);
    v.bubble.graphics.beginFill(4210752);
    v.bubble.graphics.drawRect(0, 0, c - 4, 64);
    null != v.bubbleIcon && v.bubble.removeChild(v.bubbleIcon);
    v.bubbleIcon = new I(b);
    v.bubbleIcon.set_x(8);
    v.bubbleIcon.set_y(8);
    v.bubble.addChild(v.bubbleIcon);
  };
  v.update = function () {
    if (null != v.bubble) {
      var a = 0,
        b = O.get_currentMS();
      if (-1 != v.bubbleTimer) {
        var c = b - v.bubbleTimer;
        var d = c <= 2 * v.FADE_MS + v.STAY_MS;
      } else d = !1;
      d
        ? ((a = c <= v.FADE_MS ? 0 : c <= v.FADE_MS + v.STAY_MS ? 1 : 2),
          (a =
            0 == a
              ? g.smootherStep(c / v.FADE_MS)
              : 1 == a
                ? 1
                : 1 - g.smootherStep((c - v.FADE_MS - v.STAY_MS) / v.FADE_MS)))
        : null != v.queue &&
          0 < v.queue.length &&
          ((c = v.queue.shift()), v.adjustBubble(c.name, c.icon), (v.bubbleTimer = b));
      v.bubble.set_alpha(a);
      v.bubble.set_y(-68 * (1 - a));
    }
  };
  var wb = function (a, b, c, d) {
    this.x = a;
    this.y = b;
    this.id = c;
    this.meta = null == d ? [] : d;
  };
  wb.__name__ = !0;
  wb.prototype = {
    get_block: function () {
      return F.getBlock(this.id);
    },
    getMeta: function (a) {
      return null != this.meta && null != this.meta[a] ? this.meta[a] : 0;
    },
    metaEquals: function (a) {
      if (null == this.meta && null == a) return !0;
      if (this.meta.length != a.length) return !1;
      for (var b = 0, c = a.length; b < c; ) {
        var d = b++;
        if (a[d] != this.meta[d]) return !1;
      }
      return !0;
    },
    __class__: wb
  };
  var va = function (a, b, c) {
    this.animChanged = !1;
    this.frame = this.animTimer = this.lastF = 0;
    this.origin = new Q(0, 0);
    var d = this;
    x.call(this);
    this.image = a;
    this.frameW = b;
    this.frameH = c;
    this.cols = Math.floor(this.image.width / b);
    this.rows = Math.floor(this.image.height / c);
    this.frames = this.cols * this.rows;
    this.addEventListener("render", function (e) {
      d.render(e.surface);
    });
  };
  va.__name__ = !0;
  va.__super__ = x;
  va.prototype = D(x.prototype, {
    set_frame: function (a) {
      return (this.frame = 0 > a || a >= this.frames ? 0 : a);
    },
    set_animation: function (a) {
      this.animation != a && ((this.animTimer = g.i.get_gameTimeMS()), (this.animChanged = !0));
      return (this.animation = a);
    },
    render: function (a) {
      if (null != this.animation && null != this.animation.frames && 0 < this.animation.frames.length) {
        for (var b = g.i.get_gameTimeMS() - this.animTimer, c = 0, d = !1; b > this.animation.delays[c]; )
          if (((b -= this.animation.delays[c]), ++c, c == this.animation.frames.length))
            if (((d = !0), this.animation.loop)) c = 0;
            else {
              c = this.animation.frames.length - 1;
              break;
            }
        this.frame = this.animation.frames[c];
        if (null != this.onChange && (this.animChanged || this.lastF != c)) this.onChange(c);
        if (!this.animChanged && d && null != this.onFinish) this.onFinish();
        this.lastF = c;
      } else this.frame >= this.frames && (this.frame = 0);
      a.drawImage(this.image, this.getFrameRect(this.frame), -this.origin.x, -this.origin.y);
      this.animChanged = !1;
    },
    getFrameRect: function (a) {
      return new z((a % this.cols) * this.frameW, Math.floor(a / this.cols) * this.frameH, this.frameW, this.frameH);
    },
    getBoundsSelf: function () {
      return new z(-this.origin.x, -this.origin.y, this.frameW, this.frameH);
    },
    __class__: va
  });
  var ta = function (a, b, c) {
    null == c && (c = !0);
    this.loop = !1;
    this.frames = a;
    this.delays = b;
    this.loop = c;
  };
  ta.__name__ = !0;
  ta.prototype = { __class__: ta };
  var S = function () {
    this.horizontal = this.x2 = this.dx = 0;
    va.call(this, q.cat, 24, 24);
    this.origin.x = this.frameW / 2;
    this.origin.y = this.frameH;
  };
  S.__name__ = !0;
  S.__super__ = va;
  S.prototype = D(va.prototype, {
    tick: function () {
      0 < this.horizontal
        ? this.dx < S.SPEED &&
          (this.dx < -S.ACCEL
            ? (this.dx *= S.DECCEL_MULT)
            : ((this.dx += S.ACCEL), this.dx > S.SPEED && (this.dx = S.SPEED)))
        : 0 > this.horizontal
          ? this.dx > -S.SPEED &&
            (this.dx > S.ACCEL
              ? (this.dx *= S.DECCEL_MULT)
              : ((this.dx -= S.ACCEL), this.dx < -S.SPEED && (this.dx = -S.SPEED)))
          : (this.dx *= S.DECCEL_MULT);
      this.x2 += this.dx;
      this.set_x(Math.round(this.x2));
    },
    __class__: S
  });
  var hc = function (a) {
    this.lastChanged = -1;
    this.signals = [];
    this.id = a;
  };
  hc.__name__ = !0;
  hc.prototype = {
    get_status: function () {
      return 0 < this.signals.length;
    },
    signalOn: function (a, b) {
      var c = a + "x" + b;
      0 > this.signals.indexOf(c) &&
        (this.get_status() || (this.lastChanged = g.i.get_gameTime()), this.signals.push(c));
    },
    signalOff: function (a, b) {
      var c = this.signals.indexOf(a + "x" + b);
      -1 < c && (this.signals.splice(c, 1), this.get_status() || (this.lastChanged = g.i.get_gameTime()));
    },
    __class__: hc
  };
  var Va = function (a) {
    this.x = a.x;
    this.y = a.y;
    this.channel = a.getMeta(0);
    this.length = a.getMeta(1);
    this.angle = a.getMeta(2);
  };
  Va.__name__ = !0;
  Va.canPlace = function (a, b, c) {
    if (!l.isInBounds(a, b)) return !1;
    var d = c[1];
    c = c[2];
    if (3 == c) {
      if (b < d - 1) return !1;
      d = b - (d - 1);
      for (b += 1; d < b; ) if (((c = d++), !l.isReplacable(a, c))) return !1;
    } else if (2 == c) {
      if (a < d - 1) return !1;
      d = a - (d - 1);
      for (a += 1; d < a; ) if (((c = d++), !l.isReplacable(c, b))) return !1;
    } else if (1 == c) {
      if (b > l.get_height() - d) return !1;
      c = b;
      for (b += d; c < b; ) if (((d = c++), !l.isReplacable(a, d))) return !1;
    } else {
      if (a > l.get_width() - d) return !1;
      c = a;
      for (a += d; c < a; ) if (((d = c++), !l.isReplacable(d, b))) return !1;
    }
    return !0;
  };
  Va.prototype = {
    contains: function (a, b) {
      return 3 == this.angle
        ? a == this.x && b <= this.y
          ? b > this.y - this.length
          : !1
        : 2 == this.angle
          ? b == this.y && a <= this.x
            ? a > this.x - this.length
            : !1
          : 1 == this.angle
            ? a == this.x && b >= this.y
              ? b < this.y + this.length
              : !1
            : b == this.y && a >= this.x
              ? a < this.x + this.length
              : !1;
    },
    forEach: function (a) {
      for (var b = 0, c = this.length; b < c; ) {
        var d = b++;
        3 == this.angle
          ? a(this.x, this.y - d)
          : 2 == this.angle
            ? a(this.x - d, this.y)
            : 1 == this.angle
              ? a(this.x, this.y + d)
              : a(this.x + d, this.y);
      }
    },
    __class__: Va
  };
  var J = function () {
    this.lastStep = -1;
    this.step = 0;
    this.touchingOld = [];
    this.touching = [];
    this.onRamp = this.dead = this.finished = !1;
    this.lastStuck = -1;
    this.rotateAdjust = 0;
    this.jumpTimer = this.jumpTimer2 = this.rotateTimer = -1;
    this.grounded = !1;
    this.x2 = this.y2 = this.lastX = this.lastY = this.dx = this.dy = this.horizontal = 0;
    va.call(this, q.player, 32, 48);
    this.set_animation(J.ANIM_IDLE);
    this.onChange = T(this, this.aminChange);
    this.spawnTime = g.i.get_gameTimeMS();
    this.adjust();
  };
  J.__name__ = !0;
  J.__super__ = va;
  J.prototype = D(va.prototype, {
    get_localX: function () {
      return 0 == l.rotation
        ? this.x2
        : 1 == l.rotation
          ? l.get_height() - this.y2
          : 2 == l.rotation
            ? l.get_width() - this.x2
            : this.y2;
    },
    set_localX: function (a) {
      0 == l.rotation
        ? (this.x2 = a)
        : 1 == l.rotation
          ? (this.y2 = l.get_height() - a)
          : 2 == l.rotation
            ? (this.x2 = l.get_width() - a)
            : 3 == l.rotation && (this.y2 = a);
      return a;
    },
    get_localY: function () {
      return 0 == l.rotation
        ? this.y2
        : 1 == l.rotation
          ? this.x2
          : 2 == l.rotation
            ? l.get_height() - this.y2
            : l.get_width() - this.x2;
    },
    set_localY: function (a) {
      0 == l.rotation
        ? (this.y2 = a)
        : 1 == l.rotation
          ? (this.x2 = a)
          : 2 == l.rotation
            ? (this.y2 = l.get_height() - a)
            : 3 == l.rotation && (this.x2 = l.get_width() - a);
      return a;
    },
    aminChange: function (a) {
      this.animation == J.ANIM_RUN &&
        0 == a &&
        100 < g.i.get_gameTimeMS() - this.lastStep &&
        ((g.ie && g.i.muteSFX) || u.steps.play(0 == this.step ? "a" : "b"),
        (this.lastStep = g.i.get_gameTimeMS()),
        (this.step = 0 == this.step ? 1 : 0));
    },
    adjust: function () {
      this.origin.x = this.frameW / 2;
      this.origin.y = this.frameH - (l.rotating ? n.rotateOffset : 0);
    },
    update: function () {
      if (
        !l.rotating &&
        !this.dead &&
        ((this.horizontal = this.finished ? 0 : g.getInputX()),
        0 != this.horizontal
          ? this.set_scaleX(0 < this.horizontal ? 1 : -1)
          : this.grounded && this.animation != J.ANIM_IDLE && this.set_animation(J.ANIM_IDLE),
        !this.finished && (G.keyPressed(40) || G.keyPressed(83)))
      ) {
        for (var a = 0, b = this.touching; a < b.length; ) {
          var c = b[a];
          ++a;
          c.get_block().onInteract(c);
        }
        this.touchingFinish() &&
          ((this.finished = !0), (g.ie && g.i.muteSFX) || u.exit.play(), g.i.currentScreen.finished());
      }
    },
    touchingFinish: function () {
      return l.rotating ||
        this.dead ||
        this.finished ||
        !this.grounded ||
        0 != l.rotation ||
        Math.floor(this.x2 / n.tileSize) != l.level.finishCol
        ? !1
        : Math.floor(this.y2 / n.tileSize) == l.level.finishRow + 1;
    },
    tick: function () {
      if (!l.rotating && !this.dead) {
        null == this.lastBounds && (this.lastBounds = this.getHitBounds());
        var a = J.SPEED * (this.onRamp ? J.RAMP_MULT : 1);
        0 < this.horizontal
          ? this.dx < a
            ? this.dx < -J.ACCEL
              ? (this.dx *= J.DECCEL_MULT)
              : ((this.dx += J.ACCEL), this.dx > a && (this.dx = a))
            : this.dx > a && (this.dx = a)
          : 0 > this.horizontal
            ? this.dx > -a
              ? this.dx > J.ACCEL
                ? (this.dx *= J.DECCEL_MULT)
                : ((this.dx -= J.ACCEL), this.dx < -a && (this.dx = -a))
              : this.dx < -a && (this.dx = -a)
            : (this.dx *= J.DECCEL_MULT);
        !this.finished &&
        this.grounded &&
        this.jumpKeyDown() &&
        g.i.get_gameTime() - this.jumpTimer >= J.JUMP_DELAY &&
        g.i.get_gameTime() - this.jumpTimer2 >= J.JUMP_DELAY_2
          ? ((this.dy = -J.JUMP_SPEED),
            (this.jumpTimer = g.i.get_gameTime()),
            (g.ie && g.i.muteSFX) || u.steps.play("a"),
            (this.lastStep = g.i.get_gameTimeMS()))
          : this.dy < J.GRAVITY_MAX && ((this.dy += J.GRAVITY), this.dy > J.GRAVITY_MAX && (this.dy = J.GRAVITY_MAX));
        a = this.grounded;
        this.onRamp = this.grounded = !1;
        for (
          var b = this.dx,
            c = this.dy,
            d = this.get_localX() - Math.floor(this.get_localX()),
            e = this.get_localY() - Math.floor(this.get_localY()),
            f = this.get_localX(),
            m = this.get_localY(),
            k,
            p = this.get_localY() + this.dy;
          0 != b || 0 != c;
        )
          if (
            (0 != c &&
              (0 < c
                ? 0 < e && c >= 1 - e
                  ? ((k = 1 - e), (e = 0))
                  : (k = 1 < c ? 1 : c)
                : 0 < e && c <= -e
                  ? ((k = -e), (e = 0))
                  : (k = -1 > c ? -1 : c),
              this.set_localY(this.get_localY() + k),
              (c -= k),
              this.isColliding(null, null, 1) && (this.set_localY(m), (c = this.dy = 0)),
              (m = this.get_localY())),
            0 != b)
          ) {
            0 < b
              ? 0 < d && b >= 1 - d
                ? ((k = 1 - d), (d = 0))
                : (k = 1 < b ? 1 : b)
              : 0 < d && b <= -d
                ? ((k = -d), (d = 0))
                : (k = -1 > b ? -1 : b);
            this.set_localX(this.get_localX() + k);
            b -= k;
            if (this.isColliding(null, T(this, this.rampCheckDX), 0))
              if (
                ((k = 0),
                this.set_localY(this.get_localY() - e),
                this.isColliding(null, T(this, this.nonRampCheckDX), 0))
              )
                this.set_localY(this.get_localY() + e);
              else {
                k -= e;
                if (this.isColliding(null, T(this, this.rampCheckDX), 0)) {
                  var y = this.get_localY();
                  this.set_localY(y - 1);
                  this.isColliding(null, T(this, this.nonRampCheckDX), 0)
                    ? ((y = this.get_localY()), this.set_localY(y + 1))
                    : this.isColliding(null, T(this, this.rampCheckDX), 0)
                      ? (this.set_localY(m), (k = 0))
                      : --k;
                }
                0 > k && ((e = 0), (m += k), (p += k), (this.onRamp = !0));
              }
            this.isColliding(null, null, 0) && (this.set_localX(f), (b = this.dx = 0));
            f = this.get_localX();
          }
        this.get_localY() - p < -n.E && (this.grounded = !0);
        b = g.i.get_gameTimeMS();
        c = 0 <= this.lastStuck && 100 >= b - this.lastStuck;
        if (0 <= this.dy && !this.grounded) {
          d = this.get_localY();
          e = 2 + Math.ceil(Math.abs(1.25 * this.dx));
          m = f = 0;
          for (k = p = !1; !p && !k && m < e; ) {
            f = 0 == m ? 1 - (this.get_localY() - Math.floor(this.get_localY())) : 1;
            this.set_localY(Math.round(this.get_localY() + f));
            m += f;
            k = this.isColliding(null, T(this, this.nonRampCheck), 1);
            if (!c && k) break;
            p = c && k ? !0 : this.isColliding(null, T(this, this.rampCheck), 1);
          }
          p
            ? (this.set_localY(this.get_localY() - f),
              (this.grounded = !0),
              (this.dy = 0),
              k || ((this.lastStuck = b), (this.onRamp = !0)))
            : this.set_localY(d);
        }
        this.updateTouching();
        this.grounded &&
          !a &&
          (100 < g.i.get_gameTimeMS() - this.spawnTime &&
            ((g.ie && g.i.muteSFX) || u.steps.play("b"), (this.lastStep = g.i.get_gameTimeMS())),
          (this.jumpTimer2 = g.i.get_gameTime()));
        this.grounded
          ? 0 != this.horizontal && 0.75 < Math.abs(this.dx)
            ? this.set_animation(J.ANIM_RUN)
            : this.set_animation(J.ANIM_IDLE)
          : l.rotating || (0 <= this.dy ? this.set_animation(J.ANIM_FALL) : this.set_animation(J.ANIM_JUMP));
        this.lastX = this.x2;
        this.lastY = this.y2;
        this.lastBounds = this.getHitBounds();
      }
      this.set_x(Math.round(this.x2));
      this.set_y(Math.round(this.y2));
    },
    postUpdate: function () {
      this.set_x(Math.round(this.x2));
      this.set_y(Math.round(this.y2));
    },
    getHitBounds: function (a, b, c, d, e) {
      null == e && (e = !1);
      null == d && (d = 0);
      null == c && (c = 0);
      null == b && (b = 0);
      null == a && (a = !0);
      if (a) ((b = this.x2), (c = this.y2), (d = l.rotation));
      else {
        for (; 0 > d; ) d += 4;
        for (; 3 < d; ) d -= 4;
      }
      var f = 0 == d || 2 == d,
        m = f ? J.HIT_W : J.HIT_H;
      f = f ? J.HIT_H : J.HIT_W;
      a = (a && l.rotating) || (!a && e) ? n.rotateOffset : 0;
      return 3 == d
        ? new z(b - a, c - f / 2, m, f)
        : 2 == d
          ? new z(b - m / 2, c - a, m, f)
          : 1 == d
            ? new z(b - m + a, c - f / 2, m, f)
            : new z(b - m / 2, c - f + a, m, f);
    },
    rampCheck: function (a) {
      return E.__instanceof(a, Wa)
        ? (0 != l.rotation || (0 != a.dir && 1 != a.dir)) &&
          (1 != l.rotation || (3 != a.dir && 0 != a.dir)) &&
          (2 != l.rotation || (2 != a.dir && 3 != a.dir))
          ? 3 == l.rotation
            ? 1 != a.dir
              ? 2 == a.dir
              : !0
            : !1
          : !0
        : !1;
    },
    nonRampCheck: function (a) {
      return !this.rampCheck(a);
    },
    rampCheckDX: function (a) {
      return E.__instanceof(a, Wa)
        ? (0 == l.rotation && ((0 < this.dx && 0 == a.dir) || (0 > this.dx && 1 == a.dir))) ||
          (1 == l.rotation && ((0 < this.dx && 3 == a.dir) || (0 > this.dx && 0 == a.dir))) ||
          (2 == l.rotation && ((0 < this.dx && 2 == a.dir) || (0 > this.dx && 3 == a.dir)))
          ? !0
          : 3 == l.rotation
            ? 0 < this.dx && 1 == a.dir
              ? !0
              : 0 > this.dx
                ? 2 == a.dir
                : !1
            : !1
        : !1;
    },
    nonRampCheckDX: function (a) {
      return !this.rampCheckDX(a);
    },
    isColliding: function (a, b, c) {
      null == c && (c = -1);
      a = null == a ? this.getHitBounds() : a;
      var d = g.quantize(a.get_left()),
        e = g.quantize(a.get_right() - n.E),
        f = g.quantize(a.get_top()),
        m = g.quantize(a.get_bottom() - n.E);
      for (m += 1; f < m; )
        for (var k = f++, p = d, y = e + 1; p < y; ) {
          var H = p++;
          if (!l.isInBounds(H, k)) return !0;
          var K = l.getBlockData(H, k),
            W = K.get_block();
          if (null != W && W.collides(K) && !W.isTrigger(K) && this.testBlockCollision(a, H, k, b, c)) return !0;
        }
      return !1;
    },
    updateTouching: function () {
      this.touchingOld = this.touching;
      this.touching = [];
      var a = this.getHitBounds(),
        b = g.quantize(a.get_left()),
        c = g.quantize(a.get_right() - n.E),
        d = g.quantize(a.get_top()),
        e = g.quantize(a.get_bottom() - n.E);
      for (e += 1; d < e; )
        for (var f = d++, m = b, k = c + 1; m < k; ) {
          var p = m++,
            y = l.getBlockData(p, f),
            H = y.get_block();
          if (
            null != H &&
            H.collides(y) &&
            this.testBlockCollision(a, p, f) &&
            -1 == this.touching.indexOf(y) &&
            (this.touching.push(y), -1 == this.touchingOld.indexOf(y) && H.isTrigger(y) && !H.onTrigger(y))
          )
            return;
        }
    },
    testBlockCollision: function (a, b, c, d, e) {
      null == e && (e = -1);
      var f = l.getBlockData(b, c);
      f = f.get_block().getColliders(f);
      for (var m = 0; m < f.length; ) {
        var k = f[m];
        ++m;
        if (null != k && (null == d || d(k)))
          if (E.__instanceof(k, La)) {
            if (((k = k.bounds.copy()), (k.x += b * n.tileSize), (k.y += c * n.tileSize), a.intersects(k))) return !0;
          } else if (E.__instanceof(k, Wa)) {
            var p = new Q(a.get_right(), a.get_bottom());
            1 == k.dir && (p = new Q(a.get_left(), a.get_bottom()));
            2 == k.dir && (p = new Q(a.get_left(), a.get_top()));
            3 == k.dir && (p = new Q(a.get_right(), a.get_top()));
            p.x -= b * n.tileSize;
            p.y -= c * n.tileSize;
            if (k.testPoint(p)) return !0;
          } else if (E.__instanceof(k, jb)) {
            if (((p = k.bounds.copy()), (p.x += b * n.tileSize), (p.y += c * n.tileSize), a.intersects(p))) {
              var y = 1 == l.rotation || 3 == l.rotation,
                H = 0 == l.rotation || 2 == l.rotation,
                K = -1 == e || 0 == e,
                W = -1 == e || 1 == e,
                aa = (H && K) || (y && W);
              if ((H && W) || (y && K))
                if (
                  (0 == k.dir && this.lastBounds.get_bottom() <= p.get_top()) ||
                  (2 == k.dir && this.lastBounds.get_top() >= p.get_bottom())
                )
                  return !0;
              if (
                aa &&
                ((1 == k.dir && this.lastBounds.get_left() >= p.get_right()) ||
                  (3 == k.dir && this.lastBounds.get_right() <= p.get_left()))
              )
                return !0;
            }
          } else if (
            E.__instanceof(k, kb) &&
            ((p = k),
            (k = n.tileSize),
            (y = a.copy()),
            (y.x -= b * k),
            (y.y -= c * k),
            (p = new Q(0 == p.dir || 3 == p.dir ? k : 0, 0 == p.dir || 1 == p.dir ? k : 0)),
            this.testAABBCircle(new z(a.x - b * k, a.y - c * k, a.width, a.height), p, k))
          )
            return !0;
      }
      return !1;
    },
    testAABBCircle: function (a, b, c) {
      return new z(a.x, a.y - c, a.width, a.height + 2 * c).contains(b) ||
        new z(a.x - c, a.y, a.width + 2 * c, a.height).contains(b) ||
        Q.distance(b, new Q(a.get_left(), a.get_top())) < c ||
        Q.distance(b, new Q(a.get_right(), a.get_top())) < c ||
        Q.distance(b, new Q(a.get_right(), a.get_bottom())) < c
        ? !0
        : Q.distance(b, new Q(a.get_left(), a.get_bottom())) < c;
    },
    jumpKeyDown: function () {
      return G.keyDown(38) || G.keyDown(87) ? !0 : G.keyDown(32);
    },
    canRotate: function (a) {
      if (
        !this.grounded ||
        this.jumpKeyDown() ||
        g.i.get_gameTime() - this.rotateTimer < J.ROTATE_DELAY + n.rotateTime ||
        g.i.get_gameTime() - this.jumpTimer2 < J.JUMP_DELAY_2
      )
        return !1;
      var b = this.x2,
        c = this.y2;
      this.set_localY(this.get_localY() - n.rotateOffset);
      var d = l.rotation,
        e = l;
      e.set_rotation(e.rotation + a);
      l.rotating = !0;
      a = 0;
      for (e = this.isColliding(); e && a < n.rotateOffset; )
        ((e = this.get_localY()), this.set_localY(e - 1), ++a, (e = this.isColliding(null, null, 1)));
      this.rotateAdjust = a;
      l.set_rotation(d);
      l.rotating = !1;
      this.x2 = b;
      this.y2 = c;
      return !e;
    },
    onRotateStart: function (a) {
      this.set_localY(this.get_localY() - n.rotateOffset);
      this.set_scaleX(a);
      this.adjust();
      this.set_animation(J.ANIM_ROTATE);
      this.rotateTimer = g.i.get_gameTime();
      (g.ie && g.i.muteSFX) || u.steps.play("a");
      this.lastStep = g.i.get_gameTimeMS();
      (g.ie && g.i.muteSFX) || u.rotate.play();
    },
    onRotateStart2: function () {
      this.rotStartY = this.get_localY();
    },
    onRotating: function (a) {
      this.set_localY(this.rotStartY - this.rotateAdjust * a);
    },
    onRotateEnd: function () {
      this.dx = this.dy = 0;
      this.grounded = !1;
      this.set_localY(this.rotStartY - this.rotateAdjust + n.rotateOffset);
      this.adjust();
    },
    __class__: J
  });
  var l = function () {};
  l.__name__ = !0;
  l.set_level = function (a) {
    if (null != a) {
      l.level = a;
      l.set_rotation(0);
      l.rotating = !1;
      l.tiles = [];
      for (var b = 0, c = a.tiles.length; b < c; ) {
        var d = b++;
        l.tiles[d] = [];
        for (var e = 0, f = a.tiles[d].length; e < f; ) {
          var m = e++;
          l.tiles[d][m] = a.tiles[d][m].slice(0);
        }
      }
      l.updateQueue = new Ra();
      b = 0;
      for (c = l.get_height(); b < c; )
        for (d = b++, e = 0, f = l.get_width(); e < f; ) {
          var k = e++;
          m = l.getBlockData(k, d);
          if (null == m.get_block() || 0 > m.id) l.tiles[d][k] = [0];
          else if (m.get_block().alwaysUpdate(m)) {
            var p = l.updateQueue;
            k = k + "x" + d;
            null != na[k] ? p.setReserved(k, m) : (p.h[k] = m);
          }
        }
    } else l.level = null;
    return a;
  };
  l.set_rotation = function (a) {
    for (; 0 > a; ) a += 4;
    for (; 3 < a; ) a -= 4;
    l.rotation = a;
    return l.rotation;
  };
  l.get_height = function () {
    return null != l.level ? l.tiles.length : 0;
  };
  l.get_width = function () {
    return null != l.level ? l.tiles[0].length : 0;
  };
  l.isInBounds = function (a, b) {
    return null != l.level && 0 <= a && 0 <= b && a < l.get_width() ? b < l.get_height() : !1;
  };
  l.getBlockID = function (a, b) {
    return l.isInBounds(a, b) ? l.tiles[b][a][0] : 1;
  };
  l.getBlockMeta = function (a, b) {
    return !l.isInBounds(a, b) || 2 > l.tiles[b][a].length ? [] : l.tiles[b][a].slice(1);
  };
  l.getBlockData = function (a, b) {
    return new wb(a, b, l.getBlockID(a, b), l.getBlockMeta(a, b));
  };
  l.getBlock = function (a, b) {
    return F.getBlock(l.getBlockID(a, b));
  };
  l.setBlock = function (a, b, c, d, e) {
    null == e && (e = !1);
    if (l.isInBounds(a, b)) {
      var f = a + "x" + b,
        m = l.updateQueue;
      (null != na[f] ? m.existsReserved(f) : m.h.hasOwnProperty(f)) && l.updateQueue.remove(f);
      l.tiles[b][a] = [c];
      null != d && (l.tiles[b][a] = l.tiles[b][a].concat(d));
      e && (l.level.tiles[b][a] = l.tiles[b][a].slice(0));
      a = l.getBlockData(a, b);
      F.getBlock(c).alwaysUpdate(a) && ((c = l.updateQueue), null != na[f] ? c.setReserved(f, a) : (c.h[f] = a));
    }
  };
  l.setBlockMeta = function (a, b, c, d) {
    null == d && (d = !1);
    l.isInBounds(a, b) &&
      ((l.tiles[b][a] = [l.tiles[b][a][0]]),
      null != c && (l.tiles[b][a] = l.tiles[b][a].concat(c)),
      d && (l.level.tiles[b][a] = l.tiles[b][a].slice(0)),
      (c = a + "x" + b),
      (d = l.updateQueue),
      null != na[c] ? d.existsReserved(c) : d.h.hasOwnProperty(c)) &&
      ((d = l.updateQueue), (a = l.getBlockData(a, b)), null != na[c] ? d.setReserved(c, a) : (d.h[c] = a));
  };
  l.isReplacable = function (a, b) {
    return a != l.level.startCol || (b != l.level.startRow && b != l.level.startRow - 1)
      ? a == l.level.finishCol
        ? b != l.level.finishRow
          ? b != l.level.finishRow - 1
          : !1
        : !0
      : !1;
  };
  l.onPlay = function () {
    if (null != l.level) {
      l.leversChanged = new hb();
      for (var a = 0, b = l.tiles.length; a < b; )
        for (var c = a++, d = 0, e = l.tiles[c].length; d < e; ) {
          var f = d++;
          f = l.getBlockData(f, c);
          if (null != f.get_block()) f.get_block().onPlay(f);
        }
    }
  };
  var L = function (a) {
    this.showGrid = !1;
    var b = this;
    x.call(this);
    if (null == L.bakeCanvas) {
      L.bakeCanvas = window.document.createElement("canvas");
      L.bakeCtx = L.bakeCanvas.getContext("2d", null);
      var c = L.bakeCtx;
      c.webkitImageSmoothingEnabled =
        c.mozImageSmoothingEnabled =
        c.msImageSmoothingEnabled =
        c.oImageSmoothingEnabled =
        c.imageSmoothingEnabled =
          !1;
      L.bakeSurface = new Ea(L.bakeCtx);
    }
    c = l.get_width() + 2;
    L.bakeCanvas.width = c * n.tileSize;
    c = l.get_height() + 2;
    L.bakeCanvas.height = c * n.tileSize;
    L.bakeSurface.reset();
    L.bakeSurface.clearRect(0, 0, L.bakeCanvas.width, L.bakeCanvas.height);
    if (null == L.gridCanvas && E.__instanceof(g.i.currentScreen, A)) {
      L.gridCanvas = window.document.createElement("canvas");
      L.gridCanvas.width = A.editorLevel.tiles[0].length * n.tileSize + 2;
      L.gridCanvas.height = A.editorLevel.tiles.length * n.tileSize + 2;
      L.gridCtx = L.gridCanvas.getContext("2d", null);
      L.gridSurface = new Ea(L.gridCtx);
      L.gridSurface.beginFill(2105376, 0.2);
      c = 0;
      for (var d = A.editorLevel.tiles.length + 1; c < d; )
        for (var e = c++, f = 0, m = A.editorLevel.tiles[0].length + 1; f < m; ) {
          var k = f++ * n.tileSize,
            p = e * n.tileSize;
          L.gridSurface.drawRect(k, p, 2, n.tileSize);
          L.gridSurface.drawRect(k + 2, p, n.tileSize - 2, 2);
        }
    }
    this.addEventListener("render", function (y) {
      b.render(y.surface, a);
    });
  };
  L.__name__ = !0;
  L.__super__ = x;
  L.prototype = D(x.prototype, {
    render: function (a, b) {
      if (null != l.level) {
        a.drawImage(L.bakeCanvas, null, -n.tileSize, -n.tileSize);
        var c = null;
        if (!l.rotating) {
          c = l.rotation;
          c = b.globalToLocal(1 == c || 2 == c ? h.width : 0, 2 == c || 3 == c ? h.height : 0);
          var d = Math.floor(c.x / n.tileSize),
            e = Math.floor((c.x + h.width - n.E) / n.tileSize),
            f = Math.floor(c.y / n.tileSize),
            m = Math.floor((c.y + h.height - n.E) / n.tileSize);
          c = function (fa, ka) {
            return fa >= d && ka >= f && fa <= e ? ka <= m : !1;
          };
        }
        var k = l.updateQueue;
        for (k = new fc(k, k.arrayKeys()); k.hasNext(); ) {
          var p = k.next(),
            y = l.rotating;
          if (!y)
            if (p.get_block() == F.door)
              for (var H = p.getMeta(1), K = p.getMeta(2), W = 0; W < H; ) {
                var aa = W++;
                if (
                  c(
                    3 == K || 1 == K ? p.x : 2 == K ? p.x - aa : p.x + aa,
                    2 == K || 0 == K ? p.y : 3 == K ? p.y - aa : p.y + aa
                  )
                ) {
                  y = !0;
                  break;
                }
              }
            else y = c(p.x, p.y);
          y &&
            (a.translate(p.x * n.tileSize, p.y * n.tileSize),
            p.get_block().render(a, p),
            a.translate(-p.x * n.tileSize, -p.y * n.tileSize));
        }
        this.showGrid && null != L.gridCanvas && a.drawImage(L.gridCanvas, null, 0, 0);
        if (
          E.__instanceof(g.i.currentScreen, w) &&
          ((c = g.i.currentScreen), !l.rotating && !c.player.dead && !c.player.finished)
        ) {
          k = 0;
          for (p = c.player.touching; k < p.length; )
            ((y = p[k]), ++k, y.get_block().showArrow(y) && this.renderArrow(a, y.x, y.y));
          c.player.touchingFinish() && this.renderArrow(a, l.level.finishCol, l.level.finishRow - 1, -4);
        }
      }
    },
    renderArrow: function (a, b, c, d) {
      null == d && (d = 0);
      var e = n.tileSize;
      a.translate((b + 0.5) * e, (c + 0.5) * e);
      a.rotate((-l.rotation * Math.PI) / 2);
      a.drawImage(
        q.interact,
        null,
        -q.interact.width / 2,
        Math.round(-e / 2 - q.interact.height + 2 * Math.sin(8 * g.i.get_gameTime())) + d
      );
      a.rotate((l.rotation * Math.PI) / 2);
      a.translate(-(b + 0.5) * e, -(c + 0.5) * e);
    },
    updateAllBlocks: function () {
      L.bakeSurface.setTransform(1, 0, 0, 1, 0, 0);
      L.bakeSurface.clearRect(0, 0, L.bakeCanvas.width, L.bakeCanvas.height);
      if (null != l.level) {
        for (
          var a = 1 == l.level.theme ? q.bgBricks : q.bgTiles,
            b = Math.ceil(L.bakeCanvas.width / a.width),
            c = 0,
            d = Math.ceil(L.bakeCanvas.height / a.height);
          c < d;
        )
          for (var e = c++, f = 0, m = b; f < m; ) {
            var k = f++;
            L.bakeSurface.drawImage(a, null, k * a.width, e * a.height);
          }
        this.renderDecals();
        a = -1;
        for (b = l.get_height() + 1; a < b; )
          for (c = a++, d = -1, e = l.get_width() + 1; d < e; )
            ((f = d++),
              (m = l.getBlockData(f, c)),
              (k = m.get_block()),
              null != k &&
                k.shouldRender(m) &&
                !k.alwaysUpdate(m) &&
                (L.bakeSurface.translate((f + 1) * n.tileSize, (c + 1) * n.tileSize),
                k.render(L.bakeSurface, m),
                L.bakeSurface.translate(-(f + 1) * n.tileSize, -(c + 1) * n.tileSize)));
      }
    },
    updateBlockPlus: function (a, b, c) {
      null == c && (c = !1);
      L.bakeSurface.setTransform(1, 0, 0, 1, 0, 0);
      L.bakeSurface.clearRect(a * n.tileSize, b * n.tileSize, 3 * n.tileSize, 3 * n.tileSize);
      for (var d = b - 1, e = b + 2; d < e; )
        for (var f = d++, m = a - 1, k = a + 2; m < k; ) {
          var p = m++;
          if (!c || p != a || f != b) {
            var y = l.getBlockData(p, f),
              H = y.get_block();
            if (null != H) {
              L.bakeSurface.translate((p + 1) * n.tileSize, (f + 1) * n.tileSize);
              var K = 1 == l.level.theme ? q.bgBricks : q.bgTiles;
              L.bakeSurface.drawImage(
                K,
                new z(((p + 1) * n.tileSize) % K.width, ((f + 1) * n.tileSize) % K.height, n.tileSize, n.tileSize),
                0,
                0
              );
              H.shouldRender(y) && !H.alwaysUpdate(y) && H.render(L.bakeSurface, y);
              L.bakeSurface.translate(-(p + 1) * n.tileSize, -(f + 1) * n.tileSize);
            }
          }
        }
      this.renderDecals();
    },
    renderDecals: function () {
      var a = n.tileSize;
      L.bakeSurface.drawImage(q.blocks, new z(a, 2 * a, a, 2 * a), (l.level.startCol + 1) * a, l.level.startRow * a);
      L.bakeSurface.drawImage(
        q.blocks,
        new z(2 * a, 2 * a, a, 2 * a),
        (l.level.finishCol + 1) * a,
        l.level.finishRow * a
      );
      E.__instanceof(l.level, Aa) &&
        L.bakeSurface.drawImage(q.blocks, new z(2 * a, 2 * a, a, 2 * a), (Aa.fakeCol + 1) * a, Aa.fakeRow * a);
    },
    getBoundsSelf: function () {
      return new z(0, 0, l.get_width() * n.tileSize, l.get_height() * n.tileSize);
    },
    __class__: L
  });
  var X = function () {
    this.bubbleHeight = 46;
    this.bubbleWidth = 124;
    this.configurable = !1;
  };
  X.__name__ = !0;
  X.prototype = {
    shouldRender: function (a) {
      return !0;
    },
    render: function (a, b, c) {},
    collides: function (a) {
      return !0;
    },
    isTrigger: function (a) {
      return !1;
    },
    getColliders: function (a) {
      return [new La(new z(0, 0, n.tileSize, n.tileSize))];
    },
    onTrigger: function (a) {
      return !0;
    },
    setupBubble: function (a) {},
    getConfigMeta: function () {
      return [];
    },
    alwaysUpdate: function (a) {
      return !1;
    },
    onPlay: function (a) {},
    rotatePreview: function () {
      return !0;
    },
    showArrow: function (a) {
      return !1;
    },
    onInteract: function (a) {},
    __class__: X
  };
  var xb = function () {
    X.call(this);
  };
  xb.__name__ = !0;
  xb.__super__ = X;
  xb.prototype = D(X.prototype, {
    collides: function (a) {
      return !1;
    },
    shouldRender: function (a) {
      return !1;
    },
    __class__: xb
  });
  var yb = function () {
    this.angle = 0;
    this.length = 3;
    this.channel = 0;
    X.call(this);
    this.bubbleWidth = 148;
    this.bubbleHeight = 106;
    this.configurable = !0;
  };
  yb.__name__ = !0;
  yb.__super__ = X;
  yb.prototype = D(X.prototype, {
    set_angle: function (a) {
      return (this.angle = 0 > a ? 3 : 3 < a ? 0 : a);
    },
    collides: function (a) {
      var b = this.isOpen(a);
      !b && this.isStuck(a) && w.i.killPlayer();
      return !b;
    },
    alwaysUpdate: function (a) {
      return !0;
    },
    render: function (a, b, c) {
      null == c && (c = !0);
      var d = b.getMeta(1);
      if (!(0 >= d)) {
        var e = b.getMeta(2),
          f = n.tileSize;
        a.translate(f / 2, f / 2);
        a.rotate((e * Math.PI) / 2);
        a.translate(-f / 2, -f / 2);
        if (c) {
          var m = this.isOpen(b),
            k = 0.5 * d - 0.16666666666666666;
          c = m ? 0 : k;
          if (E.__instanceof(g.i.currentScreen, w)) {
            var p = w.i.channels,
              y = b.getMeta(0);
            p = p.h[y];
            null != p &&
              ((c = Math.min(1, (g.i.get_gameTime() - p.lastChanged) / n.doorSlideTime)),
              (c = g.smootherStep(c)),
              (c = m ? (1 - c) * k : c * k));
          }
          m = c;
          for (k = 0; 0 < m; )
            ((p = 1 < m ? 1 : m),
              a.drawImage(q.blocks, new z(3 * f, 3 * f, p * f, f), k, 0),
              a.drawImage(q.blocks, new z((4 - p) * f, 3 * f, p * f, f), d * f - k - p * f, 0),
              (m -= p),
              (k += p * f));
          a.drawImage(q.blocks, new z(4 * f, 3 * f, f, f), c * f, 0);
          a.drawImage(q.blocks, new z(5 * f, 3 * f, f, f), (d - c - 1) * f, 0);
          if (E.__instanceof(g.i.currentScreen, A) && (A.renderBlockText(a, b.getMeta(0) + ""), 1 < d))
            for (b = 1; b < d; ) ((c = b++), A.renderBlockRed(a, c * f, 0));
        } else
          (a.drawImage(q.blocks, new z(3 * f, 3 * f, 0.33333333333333337 * f, f), 0, 0),
            a.drawImage(q.blocks, new z(4 * f, 3 * f, f, f), 0.33333333333333337 * f, 0),
            a.drawImage(q.blocks, new z(5 * f, 3 * f, f, f), -0.33333333333333337 * f, 0),
            a.drawImage(
              q.blocks,
              new z(3.6666666666666665 * f, 3 * f, 0.33333333333333337 * f, f),
              0.6666666666666666 * f,
              0
            ));
        a.translate(f / 2, f / 2);
        a.rotate((-e * Math.PI) / 2);
        a.translate(-f / 2, -f / 2);
      }
    },
    isOpen: function (a) {
      return E.__instanceof(g.i.currentScreen, w) && w.i.getChannelStatus(a.getMeta(0)) ? !0 : !1;
    },
    isStuck: function (a) {
      for (var b = 0, c = w.i.player.touching; b < c.length; ) {
        var d = c[b];
        ++b;
        if (d.get_block() == this && d.getMeta(0) == a.getMeta(0)) return !0;
      }
      return !1;
    },
    setupBubble: function (a) {
      var b = this,
        c = new r(g.fontMain, "Channel");
      c.set_x(8);
      c.set_y(8);
      a.addChild(c);
      var d = new r(g.fontMain, this.channel + "");
      d.align = r.ALIGN_CENTER;
      d.xAlign = r.X_ALIGN_CENTER;
      d.set_x(this.bubbleWidth - 31);
      d.set_y(c.y);
      a.addChild(d);
      var e = new I(q.configArrow);
      e.mouseEnabled = e.buttonMode = !0;
      e.addEventListener("mouseDown", function (p) {
        1 < p.which || ((b.channel = 99 <= b.channel ? 0 : b.channel + 1), d.set_text(b.channel + ""));
      });
      e.set_x(d.x + 11);
      e.set_y(d.y + 4);
      a.addChild(e);
      var f = new I(q.configArrow);
      f.mouseEnabled = f.buttonMode = !0;
      f.addEventListener("mouseDown", function (p) {
        1 < p.which || ((b.channel = 0 >= b.channel ? 99 : b.channel - 1), d.set_text(b.channel + ""));
      });
      f.set_scaleX(-1);
      f.set_x(d.x - 11);
      f.set_y(e.y);
      a.addChild(f);
      e = new r(g.fontMain, "Length");
      e.set_x(16);
      e.set_y(c.y + 30);
      a.addChild(e);
      var m = new r(g.fontMain, this.length + "");
      m.align = r.ALIGN_CENTER;
      m.xAlign = r.X_ALIGN_CENTER;
      m.set_x(this.bubbleWidth - 31);
      m.set_y(e.y);
      a.addChild(m);
      c = new I(q.configArrow);
      c.mouseEnabled = c.buttonMode = !0;
      c.addEventListener("mouseDown", function (p) {
        1 < p.which || ((b.length = 9 <= b.length ? 1 : b.length + 1), m.set_text(b.length + ""));
      });
      c.set_x(m.x + 11);
      c.set_y(m.y + 4);
      a.addChild(c);
      f = new I(q.configArrow);
      f.mouseEnabled = f.buttonMode = !0;
      f.addEventListener("mouseDown", function (p) {
        1 < p.which || ((b.length = 1 >= b.length ? 9 : b.length - 1), m.set_text(b.length + ""));
      });
      f.set_scaleX(-1);
      f.set_x(m.x - 11);
      f.set_y(c.y);
      a.addChild(f);
      c = new r(g.fontMain, "Angle");
      c.set_x(32);
      c.set_y(e.y + 30);
      a.addChild(c);
      var k = new r(g.fontMain, this.angle + "");
      k.align = r.ALIGN_CENTER;
      k.xAlign = r.X_ALIGN_CENTER;
      k.set_x(this.bubbleWidth - 31);
      k.set_y(c.y);
      a.addChild(k);
      e = new I(q.configArrow);
      e.mouseEnabled = e.buttonMode = !0;
      e.addEventListener("mouseDown", function (p) {
        1 < p.which || (b.set_angle(b.angle + 1), k.set_text(b.angle + ""));
      });
      e.set_x(k.x + 11);
      e.set_y(k.y + 4);
      a.addChild(e);
      c = new I(q.configArrow);
      c.mouseEnabled = c.buttonMode = !0;
      c.addEventListener("mouseDown", function (p) {
        1 < p.which || (b.set_angle(b.angle - 1), k.set_text(b.angle + ""));
      });
      c.set_scaleX(-1);
      c.set_x(k.x - 11);
      c.set_y(e.y);
      a.addChild(c);
    },
    getConfigMeta: function () {
      return [this.channel, this.length, this.angle];
    },
    __class__: yb
  });
  var da = function () {
    this.angle = 0;
    X.call(this);
    this.configurable = !0;
  };
  da.__name__ = !0;
  da.__super__ = X;
  da.prototype = D(X.prototype, {
    set_angle: function (a) {
      return (this.angle = 0 > a ? 3 : 3 < a ? 0 : a);
    },
    setupBubble: function (a) {
      var b = this,
        c = new r(g.fontMain, "Angle");
      c.set_x(8);
      c.set_y(8);
      a.addChild(c);
      var d = new r(g.fontMain, this.angle + "");
      d.align = r.ALIGN_CENTER;
      d.xAlign = r.X_ALIGN_CENTER;
      d.set_x(this.bubbleWidth - 31);
      d.set_y(c.y);
      a.addChild(d);
      c = new I(q.configArrow);
      c.mouseEnabled = c.buttonMode = !0;
      c.addEventListener("mouseDown", function (e) {
        1 < e.which || (b.set_angle(b.angle + 1), d.set_text(b.angle + ""));
      });
      c.set_x(d.x + 11);
      c.set_y(12);
      a.addChild(c);
      c = new I(q.configArrow);
      c.mouseEnabled = c.buttonMode = !0;
      c.addEventListener("mouseDown", function (e) {
        1 < e.which || (b.set_angle(b.angle - 1), d.set_text(b.angle + ""));
      });
      c.set_scaleX(-1);
      c.set_x(d.x - 11);
      c.set_y(12);
      a.addChild(c);
    },
    getConfigMeta: function () {
      return [this.angle];
    },
    renderRotated: function (a, b, c, d) {
      var e = n.tileSize,
        f = e / 2;
      a.translate(f, f);
      a.rotate((b.getMeta(0) * Math.PI) / 2);
      a.drawImage(q.blocks, new z(c, d, e, e), -f, -f);
      a.rotate((-b.getMeta(0) * Math.PI) / 2);
      a.translate(-f, -f);
    },
    __class__: da
  });
  var zb = function () {
    da.call(this);
  };
  zb.__name__ = !0;
  zb.__super__ = da;
  zb.prototype = D(da.prototype, {
    alwaysUpdate: function (a) {
      return !0;
    },
    collides: function (a) {
      return !1;
    },
    render: function (a, b, c) {
      null == c && (c = !0);
      b = b.getMeta(0) % 4;
      c = !c || E.__instanceof(g.i.currentScreen, A) ? 0 : Math.floor(g.i.get_gameTimeMS() / 50) % 3;
      a.drawImage(
        q.blocks,
        new z(
          ((0 < b && 3 > b ? 1 : 0) + 2 * c) * n.tileSize,
          (5 + (1 < b ? 1 : 0)) * n.tileSize,
          n.tileSize,
          n.tileSize
        ),
        0,
        0
      );
    },
    __class__: zb
  });
  var Ab = function () {
    X.call(this);
  };
  Ab.__name__ = !0;
  Ab.__super__ = X;
  Ab.prototype = D(X.prototype, {
    render: function (a, b, c) {
      a.drawImage(q.blocks, new z(0, 3 * n.tileSize, n.tileSize, n.tileSize), 0, 0);
    },
    shouldRender: function (a) {
      return !1;
    },
    __class__: Ab
  });
  var Za = function () {
    this.on = !1;
    this.channel = 0;
    X.call(this);
    this.bubbleWidth = 148;
    this.bubbleHeight = 76;
    this.configurable = !0;
  };
  Za.__name__ = !0;
  Za.__super__ = X;
  Za.prototype = D(X.prototype, {
    isTrigger: function (a) {
      return !0;
    },
    showArrow: function (a) {
      return !0;
    },
    onInteract: function (a) {
      var b = a.y * l.get_width() + a.x,
        c = l.leversChanged.h[b];
      if (!(null != c && g.i.get_gameTime() - c < Za.TOGGLE_TIMER)) {
        c = w.i.channels;
        var d = a.getMeta(0),
          e = c.h[d];
        d = null != e && e.get_status();
        (c = 1 > a.getMeta(1)) ? w.i.signalOn(a.x, a.y, a.getMeta(0)) : w.i.signalOff(a.x, a.y, a.getMeta(0));
        var f = l.leversChanged,
          m = g.i.get_gameTime();
        f.h[b] = m;
        null == e && ((b = w.i.channels), (e = a.getMeta(0)), (e = b.h[e]));
        e = null != e && e.get_status();
        b = !1;
        if (d != e)
          for (d = 0, e = w.i.doors; d < e.length; )
            if (((f = e[d]), ++d, f.channel == a.getMeta(0))) {
              b = !0;
              break;
            }
        c ? (g.ie && g.i.muteSFX) || u.leverOn.play() : (g.ie && g.i.muteSFX) || u.leverOff.play();
        !b || (g.ie && g.i.muteSFX) || u.door.play();
        l.setBlockMeta(a.x, a.y, [a.getMeta(0), c ? 1 : 0]);
      }
    },
    onPlay: function (a) {
      0 < a.getMeta(1) && w.i.signalOn(a.x, a.y, a.getMeta(0));
    },
    getColliders: function (a) {
      return [new La(new z(0.15 * n.tileSize, 0.15 * n.tileSize, 0.7 * n.tileSize, 0.7 * n.tileSize))];
    },
    alwaysUpdate: function (a) {
      return !E.__instanceof(g.i.currentScreen, A);
    },
    render: function (a, b, c) {
      null == c && (c = !0);
      var d = 0 < b.getMeta(1);
      a.drawImage(q.blocks, new z((d ? 4 : 3) * n.tileSize, 2 * n.tileSize, n.tileSize, n.tileSize), 0, 0);
      c && E.__instanceof(g.i.currentScreen, A) && A.renderBlockText(a, b.getMeta(0) + "");
    },
    setupBubble: function (a) {
      var b = this,
        c = new r(g.fontMain, "Channel");
      c.set_x(8);
      c.set_y(8);
      a.addChild(c);
      var d = new r(g.fontMain, this.channel + "");
      d.align = r.ALIGN_CENTER;
      d.xAlign = r.X_ALIGN_CENTER;
      d.set_x(this.bubbleWidth - 31);
      d.set_y(c.y);
      a.addChild(d);
      var e = new I(q.configArrow);
      e.mouseEnabled = e.buttonMode = !0;
      e.addEventListener("mouseDown", function (k) {
        1 < k.which || ((b.channel = 98 < b.channel ? 0 : b.channel + 1), d.set_text(b.channel + ""));
      });
      e.set_x(d.x + 11);
      e.set_y(d.y + 4);
      a.addChild(e);
      var f = new I(q.configArrow);
      f.mouseEnabled = f.buttonMode = !0;
      f.addEventListener("mouseDown", function (k) {
        1 < k.which || ((b.channel = 1 > b.channel ? 99 : b.channel - 1), d.set_text(b.channel + ""));
      });
      f.set_scaleX(-1);
      f.set_x(d.x - 11);
      f.set_y(e.y);
      a.addChild(f);
      e = new r(g.fontMain, "State");
      e.set_x(32);
      e.set_y(c.y + 30);
      a.addChild(e);
      var m = new r(g.fontMain, this.on ? "1" : "0");
      m.align = r.ALIGN_CENTER;
      m.xAlign = r.X_ALIGN_CENTER;
      m.set_x(this.bubbleWidth - 31);
      m.set_y(e.y);
      a.addChild(m);
      c = new I(q.configArrow);
      c.mouseEnabled = c.buttonMode = !0;
      c.addEventListener("mouseDown", function (k) {
        1 < k.which || ((b.on = !b.on), m.set_text(b.on ? "1" : "0"));
      });
      c.set_x(m.x + 11);
      c.set_y(m.y + 4);
      a.addChild(c);
      e = new I(q.configArrow);
      e.mouseEnabled = e.buttonMode = !0;
      e.addEventListener("mouseDown", function (k) {
        1 < k.which || ((b.on = !b.on), m.set_text(b.on ? "1" : "0"));
      });
      e.set_scaleX(-1);
      e.set_x(m.x - 11);
      e.set_y(c.y);
      a.addChild(e);
    },
    getConfigMeta: function () {
      return [this.channel, this.on ? 1 : 0];
    },
    __class__: Za
  });
  var wa = function () {
    X.call(this);
  };
  wa.__name__ = !0;
  wa.__super__ = X;
  wa.prototype = D(X.prototype, {
    render: function (a, b, c) {
      null == c && (c = !0);
      var d = c && this.testCanSolidConnect(b.x - 1, b.y - 1, 0),
        e = c && this.testCanSolidConnect(b.x, b.y - 1, 1),
        f = c && this.testCanSolidConnect(b.x + 1, b.y - 1, 2),
        m = c && this.testCanSolidConnect(b.x + 1, b.y, 3),
        k = c && this.testCanSolidConnect(b.x + 1, b.y + 1, 4),
        p = c && this.testCanSolidConnect(b.x, b.y + 1, 5),
        y = c && this.testCanSolidConnect(b.x - 1, b.y + 1, 6);
      b = c && this.testCanSolidConnect(b.x - 1, b.y, 7);
      f = e || m ? (m ? (e ? (f ? 0 : 1) : 2) : 3) : 4;
      y = p || b ? (b ? (p ? (y ? 0 : 1) : 2) : 3) : 4;
      m = p || m ? (m ? (p ? (k ? 0 : 1) : 2) : 3) : 4;
      k = n.tileSize;
      p = n.tileSize / 2;
      a.drawImage(q.blocks, new z((e || b ? (b ? (e ? (d ? 0 : 1) : 2) : 3) : 4) * k, 0, p, p), 0, 0);
      a.drawImage(q.blocks, new z(f * k + p, 0, p, p), p, 0);
      a.drawImage(q.blocks, new z(y * k, p, p, p), 0, p);
      a.drawImage(q.blocks, new z(m * k + p, p, p, p), p, p);
    },
    testCanSolidConnect: function (a, b, c) {
      if (!l.isInBounds(a, b)) return !0;
      a = l.getBlockData(a, b);
      b = a.get_block();
      if (E.__instanceof(b, wa)) return !0;
      a.getMeta(0);
      return !1;
    },
    __class__: wa
  });
  var Bb = function () {
    this.value = 1;
    X.call(this);
    this.configurable = !0;
  };
  Bb.__name__ = !0;
  Bb.__super__ = wa;
  Bb.prototype = D(wa.prototype, {
    set_value: function (a) {
      return (this.value = 0 > a ? 99 : 99 < a ? 0 : a);
    },
    render: function (a, b, c) {
      null == c && (c = !0);
      c
        ? wa.prototype.render.call(this, a, b, c)
        : a.drawImage(q.blocks, new z(0, 0, n.tileSize, n.tileSize), 0, 0, !1);
      b = b.getMeta(0);
      0 > b
        ? (a.drawImage(q.blocks, new z(100, 4 * n.tileSize, 10, n.tileSize), 14, 0, !1),
          -1 == b && a.drawImage(q.blocks, new z(110, 4 * n.tileSize, 10, n.tileSize), 0, 0, !1),
          -2 == b && a.drawImage(q.blocks, new z(120, 4 * n.tileSize, 10, n.tileSize), 0, 0, !1))
        : (a.drawImage(q.blocks, new z((b % 10) * 10, 4 * n.tileSize, 10, n.tileSize), 14, 0, !1),
          a.drawImage(
            q.blocks,
            new z(10 * Math.min(Math.floor(0.1 * b), 9), 4 * n.tileSize, 10, n.tileSize),
            0,
            0,
            !1
          ));
    },
    setupBubble: function (a) {
      var b = this,
        c = new r(g.fontMain, "Value");
      c.set_x(8);
      c.set_y(8);
      a.addChild(c);
      var d = new r(g.fontMain, this.value + "");
      d.align = r.ALIGN_CENTER;
      d.xAlign = r.X_ALIGN_CENTER;
      d.set_x(this.bubbleWidth - 31);
      d.set_y(c.y);
      a.addChild(d);
      c = new I(q.configArrow);
      c.mouseEnabled = c.buttonMode = !0;
      c.addEventListener("mouseDown", function (e) {
        1 < e.which || (b.set_value(b.value + 1), d.set_text(b.value + ""));
      });
      c.set_x(d.x + 11);
      c.set_y(12);
      a.addChild(c);
      c = new I(q.configArrow);
      c.mouseEnabled = c.buttonMode = !0;
      c.addEventListener("mouseDown", function (e) {
        1 < e.which || (b.set_value(b.value - 1), d.set_text(b.value + ""));
      });
      c.set_scaleX(-1);
      c.set_x(d.x - 11);
      c.set_y(12);
      a.addChild(c);
    },
    getConfigMeta: function () {
      return [this.value];
    },
    __class__: Bb
  });
  var Cb = function () {
    da.call(this);
  };
  Cb.__name__ = !0;
  Cb.__super__ = da;
  Cb.prototype = D(da.prototype, {
    render: function (a, b, c) {
      this.renderRotated(a, b, 7 * n.tileSize, 0);
    },
    getColliders: function (a) {
      return [new jb(a.getMeta(0))];
    },
    __class__: Cb
  });
  var $a = function () {
    da.call(this);
  };
  $a.__name__ = !0;
  $a.__super__ = da;
  $a.prototype = D(da.prototype, {
    render: function (a, b, c) {
      this.renderRotated(a, b, 6 * n.tileSize, 0);
    },
    getColliders: function (a) {
      return [new Wa(a.getMeta(0))];
    },
    __class__: $a
  });
  var Db = function () {
    da.call(this);
  };
  Db.__name__ = !0;
  Db.__super__ = da;
  Db.prototype = D(da.prototype, {
    isTrigger: function (a) {
      return !0;
    },
    render: function (a, b, c) {
      null == c && (c = !0);
      var d = g.i.get_gameTimeMS() / 40;
      c = !c || E.__instanceof(g.i.currentScreen, A) ? 0 : Math.floor(d - (d < n.E ? 0 : n.E)) % 3;
      this.renderRotated(a, b, (4 + c) * n.tileSize, n.tileSize);
    },
    getColliders: function (a) {
      return [new kb(a.getMeta(0))];
    },
    onTrigger: function (a) {
      w.i.killPlayer(!0);
      return !1;
    },
    alwaysUpdate: function (a) {
      return !E.__instanceof(g.i.currentScreen, A);
    },
    __class__: Db
  });
  var Eb = function () {
    da.call(this);
  };
  Eb.__name__ = !0;
  Eb.__super__ = da;
  Eb.prototype = D(da.prototype, {
    isTrigger: function (a) {
      return !0;
    },
    render: function (a, b, c) {
      null == c && (c = !0);
      this.renderRotated(a, b, (c ? Math.floor((b.x + b.y) % 4) : 0) * n.tileSize, n.tileSize);
    },
    getColliders: function (a) {
      var b = n.tileSize;
      var c = b / 2,
        d = 0.5 * b,
        e = (b - d) / 2;
      3 == a.getMeta(0)
        ? ((a = new z(0, e, c, d)), (b = new z(c, 0, c, b)))
        : 2 == a.getMeta(0)
          ? ((a = new z(e, b - c, d, c)), (b = new z(0, 0, b, c)))
          : 1 == a.getMeta(0)
            ? ((a = new z(b - c, e, c, d)), (b = new z(0, 0, c, b)))
            : ((a = new z(e, 0, d, c)), (b = new z(0, c, b, c)));
      return [new La(a), new La(b)];
    },
    onTrigger: function (a) {
      w.i.killPlayer();
      return !1;
    },
    __class__: Eb
  });
  var Fb = function () {
    da.call(this);
  };
  Fb.__name__ = !0;
  Fb.__super__ = $a;
  Fb.prototype = D($a.prototype, {
    render: function (a, b, c) {
      c = n.tileSize;
      var d = c / 2;
      a.translate(d, d);
      1 < b.getMeta(0) && a.rotate(Math.PI);
      (1 != b.getMeta(0) && 3 != b.getMeta(0)) || a.scale(-1, 1);
      a.drawImage(q.blocks, new z(5 * n.tileSize, 0, c, c), -d, -d);
      (1 != b.getMeta(0) && 3 != b.getMeta(0)) || a.scale(-1, 1);
      1 < b.getMeta(0) && a.rotate(-Math.PI);
      a.translate(-d, -d);
    },
    __class__: Fb
  });
  var Gb = function () {
    X.call(this);
  };
  Gb.__name__ = !0;
  Gb.__super__ = X;
  Gb.prototype = D(X.prototype, {
    render: function (a, b, c) {
      a.drawImage(q.blocks, new z(0, 2 * n.tileSize, n.tileSize, n.tileSize), 0, 0);
    },
    shouldRender: function (a) {
      return !1;
    },
    __class__: Gb
  });
  var Hb = function () {
    X.call(this);
  };
  Hb.__name__ = !0;
  Hb.__super__ = wa;
  Hb.prototype = D(wa.prototype, {
    render: function (a, b, c) {
      null == c && (c = !0);
      c
        ? wa.prototype.render.call(this, a, b, c)
        : a.drawImage(q.blocks, new z(0, 0, n.tileSize, n.tileSize), 0, 0, !1);
      a.drawImage(q.blocks, new z(5 * n.tileSize, 2 * n.tileSize, n.tileSize, n.tileSize), 0, 0, !1);
    },
    __class__: Hb
  });
  var F = function () {};
  F.__name__ = !0;
  F.register = function (a, b) {
    return null == F.registry[a] ? ((F.registry[a] = b), (b.id = a), b) : null;
  };
  F.getBlock = function (a) {
    return F.registry[a];
  };
  var ab = function (a, b, c, d, e, f, m, k, p) {
    null == k && (k = 0);
    null == m && (m = 0);
    this.freeze = !1;
    this.size = a;
    this.life = b;
    this.x = this.lastX = c;
    this.y = this.lastY = d;
    this.dx = e;
    this.dy = f;
    this.gravityX = m;
    this.gravityY = k;
    this.handler = p;
  };
  ab.__name__ = !0;
  ab.prototype = {
    update: function () {
      if (!this.freeze || 0 >= this.life)
        ((this.dx += this.gravityX * ab.GRAVITY_MULT),
          (this.dy += this.gravityY * ab.GRAVITY_MULT),
          (this.x += this.dx),
          (this.y += this.dy),
          null != this.handler && this.handler(this),
          0 < this.life && this.life--,
          (this.lastX = this.x),
          (this.lastY = this.y));
    },
    __class__: ab
  };
  var Ib = function (a, b, c, d, e, f, m, k, p) {
    null == p && (p = 1);
    null == k && (k = !1);
    this.particles = [];
    var y = this;
    x.call(this);
    this.color = c;
    for (c = 0; 75 > c; ) {
      c++;
      var H = Math.random() * Math.PI * 2,
        K = 3 * (0.7 * Math.random() + 0.3) * p,
        W = 20 * Math.random();
      H = new ab(
        6 * (0.6 * Math.random() + 0.4),
        Math.round(50 * (0.5 * Math.random() + 0.5)),
        a + Math.cos(H) * W,
        b + Math.sin(H) * W,
        d + Math.cos(H) * K,
        e + Math.sin(H) * K,
        f,
        m,
        k ? T(this, this.collsionHandler) : null
      );
      this.particles.push(H);
    }
    this.addEventListener("enterFrame", T(this, this.update));
    this.addEventListener("render", function (aa) {
      y.render(aa.surface);
    });
  };
  Ib.__name__ = !0;
  Ib.__super__ = x;
  Ib.prototype = D(x.prototype, {
    update: function (a) {
      if (!g.i.paused)
        for (a = this.particles.length; 0 <= --a; ) {
          var b = this.particles[a];
          0 >= b.life ? this.particles.splice(a, 1) : b.update();
        }
    },
    collsionHandler: function (a) {
      var b = Math.floor(a.x / n.tileSize),
        c = Math.floor(a.y / n.tileSize);
      if (l.isInBounds(b, c)) {
        var d = l.getBlockData(b, c),
          e = d.get_block();
        if (e.collides(d) && !e.isTrigger(d)) {
          var f = new Q(a.x - b * n.tileSize, a.y - c * n.tileSize);
          d = e.getColliders(d);
          for (e = 0; e < d.length; ) {
            var m = d[e];
            ++e;
            if (m.testPoint(f, new Q(a.lastX - b * n.tileSize, a.lastY - c * n.tileSize))) {
              a.freeze = !0;
              break;
            }
          }
        }
      } else a.freeze = !0;
    },
    render: function (a) {
      a.beginFill(this.color);
      for (var b = 0, c = this.particles; b < c.length; ) {
        var d = c[b];
        ++b;
        var e = Math.round(d.size),
          f = d.size / 2;
        a.drawRect(Math.round(d.x - f), Math.round(d.y - f), e, e);
      }
    },
    __class__: Ib
  });
  var ea = function () {};
  ea.__name__ = !0;
  ea.prototype = { __class__: ea };
  var pa = function () {
    this.startDir = 1;
    this.theme = 0;
    this.reset();
  };
  pa.__name__ = !0;
  pa.__interfaces__ = [ea];
  pa.prototype = {
    reset: function () {
      this.tiles = [];
      for (var a = 0, b = pa.WORLD_SIZE; a < b; ) {
        var c = a++;
        this.tiles[c] = [];
        for (var d = 0, e = pa.WORLD_SIZE; d < e; ) {
          var f = d++;
          this.tiles[c][f] = [13 < f && 28 > f && 17 < c && 24 > c ? 0 : 1, 0];
        }
      }
      this.startCol = 16;
      this.startRow = 23;
      this.finishCol = 25;
      this.finishRow = 23;
      this.theme = 0;
    },
    load: function (a, b, c, d, e, f) {
      null == f && (f = 0);
      this.tiles = a;
      this.startCol = b;
      this.startRow = c;
      this.finishCol = d;
      this.finishRow = e;
      this.theme = f;
    },
    setStart: function (a, b) {
      this.startCol = a;
      this.startRow = b;
    },
    setFinish: function (a, b) {
      this.finishCol = a;
      this.finishRow = b;
    },
    start: function () {
      this.speech = new U([]);
    },
    tick: function () {},
    update: function () {
      this.speech.update();
    },
    finished: function () {
      g.i.changeScreen(new A());
      return null;
    },
    kill: function () {},
    __class__: pa
  };
  var ha = function () {
    this.startDir = 1;
    this.finishRow = 3;
    this.finishCol = 25;
    this.startRow = 7;
    this.startCol = 4;
    this.tiles = [
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [7, -1],
        [7, 1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0]
      ],
      [
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [10],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [10],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [2, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [2, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ]
    ];
    this.theme = 0;
  };
  ha.__name__ = !0;
  ha.__interfaces__ = [ea];
  ha.prototype = {
    start: function () {
      var a = g.i.currentScreen;
      this.a1 = this.a2 = this.a3 = this.a4 = this.a5 = 0;
      this.s1 = !0;
      this.s2 = this.s3 = this.s4 = this.s5 = !1;
      null == this.c1 && (this.c1 = new I(q.controls1));
      this.c1.set_x(3.5 * n.tileSize);
      this.c1.set_y(9 * n.tileSize);
      this.c1.set_alpha(this.a1);
      a.overlay.addChild(this.c1);
      null == this.c2 && (this.c2 = new I(q.controls2));
      this.c2.set_x(10 * n.tileSize);
      this.c2.set_y(11 * n.tileSize);
      this.c2.set_alpha(this.a2);
      a.overlay.addChild(this.c2);
      null == this.c3 && (this.c3 = new I(q.controls3));
      this.c3.set_x(18.5 * n.tileSize);
      this.c3.set_y(9 * n.tileSize);
      this.c3.set_alpha(this.a3);
      this.c3.clipRect.width = 48;
      g.i.invert && (this.c3.clipRect.x = 48);
      a.overlay.addChild(this.c3);
      null == this.c4 && (this.c4 = new I(q.controls4));
      this.c4.set_x(29 * n.tileSize);
      this.c4.set_y(n.tileSize);
      this.c4.set_alpha(this.a4);
      this.c4.clipRect.width = 48;
      g.i.invert && (this.c4.clipRect.x = 48);
      a.overlay.addChild(this.c4);
      null == this.c5 && (this.c5 = new I(q.controls5));
      this.c5.set_x(24.5 * n.tileSize);
      this.c5.set_y(5 * n.tileSize);
      this.c5.set_alpha(this.a5);
      a.overlay.addChild(this.c5);
      this.speech = new U([new C(new M(1), "Make your way to the exit.")]);
    },
    tick: function () {
      var a = 0.25 * Math.sin(8 * g.i.get_gameTime()) + 0.75;
      this.s1 && 1 > this.a1
        ? ((this.a1 += ha.fadeSpeed), 1 < this.a1 && (this.a1 = 1))
        : !this.s1 && 0 < this.a1 && ((this.a1 -= ha.fadeSpeed), 0 > this.a1 && (this.a1 = 0));
      this.c1.set_alpha(this.a1 * a);
      this.s2 && 1 > this.a2
        ? ((this.a2 += ha.fadeSpeed), 1 < this.a2 && (this.a2 = 1))
        : !this.s2 && 0 < this.a2 && ((this.a2 -= ha.fadeSpeed), 0 > this.a2 && (this.a2 = 0));
      this.c2.set_alpha(this.a2 * a);
      this.s3 && 1 > this.a3
        ? ((this.a3 += ha.fadeSpeed), 1 < this.a3 && (this.a3 = 1))
        : !this.s3 && 0 < this.a3 && ((this.a3 -= ha.fadeSpeed), 0 > this.a3 && (this.a3 = 0));
      this.c3.set_alpha(this.a3 * a);
      this.s4 && 1 > this.a4
        ? ((this.a4 += ha.fadeSpeed), 1 < this.a4 && (this.a4 = 1))
        : !this.s4 && 0 < this.a4 && ((this.a4 -= ha.fadeSpeed), 0 > this.a4 && (this.a4 = 0));
      this.c4.set_alpha(this.a4 * a);
      this.s5 && 1 > this.a5
        ? ((this.a5 += ha.fadeSpeed), 1 < this.a5 && (this.a5 = 1))
        : !this.s5 && 0 < this.a5 && ((this.a5 -= ha.fadeSpeed), 0 > this.a5 && (this.a5 = 0));
      this.c5.set_alpha(this.a5 * a);
    },
    update: function () {
      this.speech.update();
      this.s1 && w.i.player.x > 10 * n.tileSize
        ? ((this.s1 = !1), (this.s2 = !0))
        : this.s2 && w.i.player.x > 17 * n.tileSize
          ? ((this.s2 = !1), (this.s3 = !0))
          : this.s3 && w.i.player.x > 27 * n.tileSize && w.i.player.grounded && !l.rotating && 1 == l.rotation
            ? ((this.s3 = !1), (this.s4 = !0))
            : this.s4 &&
              w.i.player.x > 22 * n.tileSize &&
              w.i.player.grounded &&
              !l.rotating &&
              0 == l.rotation &&
              ((this.s4 = !1), (this.s5 = !0));
      this.c3.clipRect.x = this.c4.clipRect.x = g.i.invert ? 48 : 0;
    },
    finished: function () {
      return B.level2;
    },
    kill: function () {
      this.c1.parent.removeChild(this.c1);
      this.c2.parent.removeChild(this.c2);
      this.c3.parent.removeChild(this.c3);
      this.c4.parent.removeChild(this.c4);
      this.c5.parent.removeChild(this.c5);
    },
    __class__: ha
  };
  var Jb = function () {
    this.startDir = 1;
    this.finishRow = 16;
    this.finishCol = 11;
    this.startRow = 18;
    this.startCol = 19;
    this.tiles = [
      [
        [1],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 1],
        [6, 3],
        [6, 2],
        [6],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [10],
        [10],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 3],
        [6, 2],
        [0],
        [0],
        [6, 3],
        [6, 2],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [11],
        [11, 1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [11, 3],
        [11, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [9, 0, 3, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [10],
        [10],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [8, 1],
        [0],
        [9],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [9],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [5, 3]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [5, 3]
      ],
      [
        [5, 1],
        [0],
        [0],
        [8],
        [0],
        [0],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [7, -2],
        [7, 10],
        [1],
        [1],
        [0],
        [0],
        [5, 3]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [9, 1, 5],
        [9, 1],
        [9, 1],
        [9, 1],
        [9, 1],
        [1],
        [10],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [6, 1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [5, 3]
      ],
      [
        [6, 3],
        [6, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [10],
        [1],
        [0],
        [0],
        [5, 3]
      ],
      [
        [6, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [6, 3],
        [6, 2],
        [6, 3],
        [6, 2],
        [6, 3],
        [6, 2],
        [1],
        [1],
        [1],
        [0],
        [0],
        [5, 3]
      ],
      [
        [6, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [6],
        [6, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [6, 2],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [2, 1],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [2, 1],
        [0],
        [0],
        [0],
        [5, 3]
      ]
    ];
    this.theme = 1;
  };
  Jb.__name__ = !0;
  Jb.__interfaces__ = [ea];
  Jb.prototype = {
    start: function () {
      this.speech = new U([
        new C(new M(2), "Why are you ignoring me?"),
        new C(new M(4), "We must continue your training."),
        new C(new V(4, 10, 6, 1, 2), "There's nothing for you this way."),
        new C(new Xa(1), ""),
        new C(new V(1.25, 7, 1, 1, 2, 1), "What do you expect to find?")
      ]);
      this.cat = new ua(9, 16, -1, 1, new V(0.5, 4, 13, 1, 4, 1));
    },
    tick: function () {},
    update: function () {
      this.speech.update();
      this.cat.update();
    },
    finished: function () {
      return B.level11;
    },
    kill: function () {},
    __class__: Jb
  };
  var Kb = function () {
    this.startDir = 1;
    this.finishRow = 7;
    this.finishCol = 24;
    this.startRow = 13;
    this.startCol = 12;
    this.tiles = [
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 1],
        [0],
        [0],
        [0],
        [3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [9, 0, 3],
        [9],
        [9],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1]
      ],
      [
        [1],
        [10],
        [10],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [6, 3],
        [6, 2],
        [6, 3],
        [6, 2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [10]
      ],
      [
        [5, 1],
        [0],
        [8],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [0],
        [8, 1],
        [0],
        [1],
        [1],
        [1],
        [9, 1, 3],
        [9, 1],
        [9, 1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [6],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [3, 1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [9, 0, 3],
        [9],
        [9],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [6, 3],
        [6, 2],
        [1],
        [1],
        [7, -2],
        [7, 11],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [11],
        [11, 1],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [11, 3],
        [11, 2],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [6],
        [6, 1],
        [6],
        [6, 1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6],
        [6, 1],
        [6],
        [6, 1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ]
    ];
    this.theme = 1;
  };
  Kb.__name__ = !0;
  Kb.__interfaces__ = [ea];
  Kb.prototype = {
    start: function () {
      this.speech = new U([
        new C(new M(1), 'Do you seek "freedom"?'),
        new C(new M(3), "An escape from responsibility?"),
        new C(new V(4, 11, 10, 3, 1), "You're running from your purpose.")
      ]);
      this.cat = new ua(21, 7, -1, 1, new ia(20, 5, 1, 3));
    },
    tick: function () {},
    update: function () {
      this.speech.update();
      this.cat.update();
    },
    finished: function () {
      return B.level12;
    },
    kill: function () {},
    __class__: Kb
  };
  var Lb = function () {
    this.startDir = 1;
    this.finishRow = 4;
    this.finishCol = 3;
    this.startRow = 2;
    this.startCol = 21;
    this.tiles = [
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [10],
        [10],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [6, 1],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [6, 3],
        [6, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [6, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [11],
        [11, 1],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 1],
        [0],
        [0],
        [0],
        [4, 2],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [6, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [11, 3],
        [11, 2],
        [0],
        [0],
        [0],
        [1],
        [1],
        [7, -2],
        [7, 12],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [2, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 1],
        [4, 1],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [2, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 2],
        [4, 1],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [3, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [1],
        [1],
        [9, 0, 3],
        [9],
        [9],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [8],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [1],
        [1],
        [0],
        [8, 1, 1],
        [0],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [9, 1, 4],
        [9, 1],
        [9, 1],
        [9, 1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [1],
        [10]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 1],
        [0],
        [0],
        [6],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 2],
        [6],
        [6, 1],
        [6, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ]
    ];
    this.theme = 1;
  };
  Lb.__name__ = !0;
  Lb.__interfaces__ = [ea];
  Lb.prototype = {
    start: function () {
      this.speech = new U([
        new C(new M(1.25), "Don't you understand?"),
        new C(new M(3.5), "You are being deceived."),
        new C(new V(3.5, 20, 7, 4, 1, 2), "The cat doesn't care about you."),
        new C(new V(5, 17, 11, 3, 1), "It's just using you.")
      ]);
      this.cat = new ua(5, 4, 1, -1, new ia(6, 2, 3, 5, 0));
    },
    tick: function () {},
    update: function () {
      this.speech.update();
      this.cat.update();
    },
    finished: function () {
      return B.level13;
    },
    kill: function () {},
    __class__: Lb
  };
  var Mb = function () {
    this.startDir = 1;
    this.finishRow = 21;
    this.finishCol = 14;
    this.startRow = 23;
    this.startCol = 2;
    this.tiles = [
      [[1], [1], [1], [1], [5, 2], [5, 2], [5, 2], [6], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1]],
      [[1], [1], [1], [1], [0], [0], [0], [6, 3], [6, 2], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1]],
      [[1], [1], [1], [1], [0], [8, 2], [0], [0], [5, 3], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1]],
      [[1], [1], [1], [1], [0], [0], [0], [0], [5, 3], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1]],
      [
        [1],
        [1],
        [1],
        [1],
        [9, 1, 4],
        [9, 1],
        [9, 1],
        [9, 1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [[1], [1], [5, 1], [0], [0], [0], [0], [0], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1]],
      [
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [[1], [1], [5, 1], [0], [0], [0], [4], [4], [0], [0], [0], [0], [0], [1], [1], [10], [10], [1], [1], [1]],
      [[1], [1], [5, 1], [0], [0], [0], [0], [0], [0], [0], [11], [11, 1], [0], [1], [1], [1], [1], [1], [1], [1]],
      [[1], [1], [5, 1], [0], [4], [0], [0], [0], [0], [0], [11, 3], [11, 2], [0], [0], [0], [0], [0], [0], [6], [1]],
      [[1], [1], [5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [8, 1], [0], [6, 3], [1]],
      [[1], [1], [1], [1], [1], [1], [1], [1], [1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [6], [1]],
      [[1], [1], [1], [1], [1], [1], [1], [1], [1], [0], [0], [0], [0], [1], [1], [5], [5], [5], [6, 3], [1]],
      [[1], [1], [1], [1], [1], [1], [6, 1], [6, 3], [6, 2], [0], [0], [0], [0], [1], [1], [1], [1], [1], [1], [1]],
      [[1], [1], [1], [1], [1], [6, 3], [6, 2], [0], [0], [0], [0], [0], [0], [1], [1], [1], [1], [1], [1], [1]],
      [[1], [1], [1], [1], [1], [0], [0], [0], [0], [0], [0], [0], [2], [1], [1], [1], [1], [1], [1], [1]],
      [[1], [1], [1], [1], [1], [0], [0], [0], [0], [0], [0], [2], [1], [1], [1], [1], [1], [1], [1], [1]],
      [[1], [1], [1], [1], [1], [9, 0, 3], [9], [9], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1]],
      [[1], [7, -2], [7, 13], [1], [1], [0], [0], [0], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1]],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [9, 2, 3, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [9, 0, 3, 1],
        [5, 3],
        [1],
        [1]
      ],
      [[1], [1], [1], [1], [1], [0], [0], [0], [0], [0], [9, 2], [0], [0], [0], [0], [0], [9], [5, 3], [1], [1]],
      [[5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [9, 2], [0], [0], [0], [0], [0], [9], [5, 3], [1], [10]],
      [[5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1]],
      [[5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1]],
      [[1], [1], [1], [1], [1], [0], [0], [0], [0], [0], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1]],
      [[1], [1], [1], [1], [1], [0], [0], [0], [0], [0], [0], [0], [0], [6], [1], [1], [1], [1], [1], [1]],
      [[1], [1], [1], [1], [1], [0], [0], [0], [0], [0], [0], [8], [0], [6, 3], [6, 2], [1], [1], [1], [1], [1]],
      [[1], [1], [3, 2], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [6], [1], [1], [1], [1], [1]],
      [[1], [1], [0], [11], [11, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [6, 3], [1], [1], [1], [1], [1]],
      [[1], [1], [0], [11, 3], [11, 2], [0], [0], [0], [0], [0], [0], [0], [6], [6, 1], [1], [1], [1], [1], [1], [1]],
      [[1], [1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [6, 3], [1], [1], [1], [1], [1], [1], [1]],
      [[1], [1], [5], [5], [5], [5], [5], [5], [5], [5], [5], [5], [1], [1], [1], [1], [1], [1], [1], [1]]
    ];
    this.theme = 1;
  };
  Mb.__name__ = !0;
  Mb.__interfaces__ = [ea];
  Mb.prototype = {
    start: function () {
      this.speech = new U([
        new C(new M(2), "This has happened before."),
        new C(new M(4.5), "It tried to lure the others away."),
        new C(new V(1, 13, 9, 1, 3), "But they listened to reason."),
        new C(new M(7), "They came back to join me."),
        new C(new Xa(0), ""),
        new C(new M(0.75), "I expected better from you.")
      ]);
      this.cat = new ua(12, 21, -1, 1, new ia(10, 19, 6, 3, 1));
    },
    tick: function () {},
    update: function () {
      this.speech.update();
      this.cat.update();
    },
    finished: function () {
      return B.level14;
    },
    kill: function () {},
    __class__: Mb
  };
  var Nb = function () {
    this.cond3 = new M(12);
    this.cond2 = new M(10);
    this.cond1 = new Xa(1);
    this.startDir = -1;
    this.finishRow = 7;
    this.finishCol = 13;
    this.startRow = 22;
    this.startCol = 30;
    this.tiles = [
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 1],
        [6, 3],
        [6, 2],
        [6, 3],
        [6, 2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [5, 2],
        [5, 2],
        [5, 2],
        [6, 3],
        [6, 2],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [0],
        [8, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [10],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [9, 2, 4, 1],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [9, 2],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [9, 2],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [9, 2],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [6, 1],
        [5, 2],
        [5, 2],
        [5, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [6, 3],
        [6, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [7, -2],
        [7, 14],
        [1],
        [1],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [6],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [6, 3],
        [6, 2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [10],
        [10],
        [1],
        [1],
        [10],
        [10]
      ],
      [
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [9, 2, 4],
        [9, 2],
        [9, 2],
        [9, 2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [8, 1],
        [0],
        [11],
        [11, 1],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [11],
        [11, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [11],
        [11, 1],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [11, 3],
        [11, 2],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [11, 3],
        [11, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [11, 3],
        [11, 2],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [9, 0, 3, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [4],
        [4],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [9],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [9],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [8],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [6],
        [6, 1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [4, 3],
        [0],
        [1],
        [1],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5],
        [5],
        [5],
        [5],
        [6, 3],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 1],
        [5],
        [5],
        [5],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5],
        [5],
        [5],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [10],
        [10],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6],
        [6, 1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 2],
        [6],
        [6, 1],
        [6],
        [6, 1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ]
    ];
    this.theme = 1;
  };
  Nb.__name__ = !0;
  Nb.__interfaces__ = [ea];
  Nb.prototype = {
    start: function () {
      this.cond1.start();
      this.done1 = this.done2 = this.done3 = !1;
      this.speech = new U([
        new C(new M(1.5), "I can't let you keep going."),
        new C(new V(1.5, 33, 14, 5, 2), "You have what belongs to me."),
        new C(new M(4.5), "And it isn't yours to take."),
        new C(this.cond1, ""),
        new C(new M(0.5), "Stop running."),
        new C(new M(2), "You see, I gave you your mind."),
        new C(new M(3.75), "It was a part of me."),
        new C(new M(3.25), "Now I need it back."),
        new C(new M(3), "Wait, no!"),
        new C(new V(0.5, 5, 10, 1, 2), "I hate you, cat.")
      ]);
      this.cat = new ua(5, 4, 1, -1, new V(1, 10, 1, 1, 11, 1));
    },
    tick: function () {},
    update: function () {
      this.speech.update();
      this.cat.update();
      if (this.done1) {
        if (
          (!this.done2 &&
            this.cond2.test() &&
            ((this.done2 = !0), (g.ie && g.i.muteSFX) || (u.cat.volume(0.5), u.cat.play())),
          !this.done3 && this.cond3.test())
        ) {
          this.done3 = !0;
          var a = l.getBlockData(3, 3);
          a.get_block().onInteract(a);
        }
      } else this.cond1.test() && ((this.done1 = !0), this.cond2.start(), this.cond3.start());
    },
    finished: function () {
      return B.level15;
    },
    kill: function () {},
    __class__: Nb
  };
  var Ob = function () {
    this.startDir = -1;
    this.finishRow = 19;
    this.finishCol = 22;
    this.startRow = 27;
    this.startCol = 20;
    this.tiles = [
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 3],
        [6, 2],
        [6, 3],
        [6, 2],
        [6, 3],
        [6, 2],
        [6, 3],
        [6, 2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [10],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [8, 1],
        [0],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [11],
        [11, 1],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [11, 3],
        [11, 2],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 3],
        [6, 2],
        [6, 3],
        [6, 2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [6, 1],
        [0],
        [9, 0, 4, 1],
        [0],
        [0],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [7, -2],
        [7, 15],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [6, 2],
        [0],
        [9],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [10],
        [10],
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [6, 1],
        [0],
        [9],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [9, 2, 4],
        [9, 2],
        [9, 2],
        [9, 2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [6, 2],
        [0],
        [9],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [2, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [11],
        [11, 1],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [2, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [11, 3],
        [11, 2],
        [0],
        [9, 0, 2, 1],
        [0],
        [0],
        [0],
        [0],
        [6],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 2],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [2, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [9],
        [0],
        [0],
        [0],
        [0],
        [6, 3],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [6],
        [6, 1],
        [0],
        [8],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [6],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 2],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [6, 3],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5],
        [5],
        [5],
        [1],
        [10],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [9, 1, 4],
        [9, 1],
        [9, 1],
        [9, 1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [4, 1],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [4, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5],
        [5],
        [5],
        [5],
        [5],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [10],
        [1],
        [0],
        [8, 2],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [5, 3]
      ]
    ];
    this.theme = 1;
  };
  Ob.__name__ = !0;
  Ob.__interfaces__ = [ea];
  Ob.prototype = {
    start: function () {
      this.speech = new U([
        new C(new M(2), "I don't understand."),
        new C(new M(5), "Why do you run from the truth?"),
        new C(new V(4.5, 1, 8, 6, 1, 0), "I gave you everything that you are."),
        new C(new M(5.5), "You seek freedom at my expense."),
        new C(new V(5.5, 26, 30, 4, 1), "You're just like me, and I hate it.")
      ]);
      this.cat = new ua(20, 19, -1, 1, new ia(17, 13, 4, 3));
    },
    tick: function () {},
    update: function () {
      this.speech.update();
      this.cat.update();
    },
    finished: function () {
      return B.level16;
    },
    kill: function () {},
    __class__: Ob
  };
  var Pb = function () {
    this.startDir = 1;
    this.finishRow = 2;
    this.finishCol = 38;
    this.startRow = 11;
    this.startCol = 16;
    this.tiles = [
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [0],
        [0]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [2],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 2],
        [0],
        [9, 2, 3, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [2],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [10],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [9, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [2],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [9, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [2],
        [1],
        [1],
        [10],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [11],
        [11, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [9, 0, 3, 1],
        [0],
        [9, 1, 3, 1],
        [0],
        [0],
        [0],
        [2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [11, 3],
        [11, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [9],
        [0],
        [9, 1],
        [0],
        [0],
        [2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [9],
        [0],
        [9, 1],
        [0],
        [2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [6],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [6, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [6],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [7, -2],
        [7, 16],
        [1],
        [1],
        [0],
        [0],
        [6, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [8],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [10],
        [10],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [2],
        [1],
        [10],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [5],
        [5],
        [5],
        [5],
        [5],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [1],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [9, 1, 5],
        [9, 1],
        [9, 1],
        [9, 1],
        [9, 1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [10],
        [1],
        [0],
        [0],
        [0],
        [0],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [9, 0, 4],
        [9],
        [9],
        [9],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [9, 0, 4],
        [9],
        [9],
        [9],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [6, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [6, 2],
        [0],
        [0],
        [11],
        [11, 1],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [4, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [6, 1],
        [0],
        [8, 1],
        [11, 3],
        [11, 2],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [4, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [6, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [8, 2],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [10],
        [1],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ]
    ];
    this.theme = 1;
  };
  Pb.__name__ = !0;
  Pb.__interfaces__ = [ea];
  Pb.prototype = {
    start: function () {
      this.speech = new U([
        new C(new M(4), "I'm tired of trying to convince you."),
        new C(new ia(2, 32, 4, 1), 'Just leave, have your "freedom".'),
        new C(new M(5), "You'll come to regret this mistake."),
        new C(new Xa(2), ""),
        new C(new M(4), "You will realize I was right."),
        new C(new lb(22, 7, 1, 3), "You can't escape your purpose.")
      ]);
      this.cat = new ua(28, 6, -1, 1, new lb(22, 7, 1, 3));
    },
    tick: function () {},
    update: function () {
      this.speech.update();
      this.cat.update();
    },
    finished: function () {
      g.i.changeScreen(new bb(E.__cast(g.i.currentScreen, w).speedrun));
      return null;
    },
    kill: function () {},
    __class__: Pb
  };
  var Qb = function () {
    this.startDir = 1;
    this.finishRow = 3;
    this.finishCol = 15;
    this.startRow = 11;
    this.startCol = 2;
    this.tiles = [
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [10]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [10],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [3, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5],
        [5],
        [5],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [7, -1],
        [7, 2],
        [1],
        [1],
        [1],
        [1]
      ]
    ];
    this.theme = 0;
  };
  Qb.__name__ = !0;
  Qb.__interfaces__ = [ea];
  Qb.prototype = {
    start: function () {
      this.speech = new U([
        new C(new M(0.5), "Be careful with the spikes."),
        new C(new V(2, 9, 8, 1, 4), "You aren't very useful dead.")
      ]);
    },
    tick: function () {},
    update: function () {
      this.speech.update();
    },
    finished: function () {
      return B.level3;
    },
    kill: function () {},
    __class__: Qb
  };
  var Rb = function () {
    this.startDir = -1;
    this.finishRow = 6;
    this.finishCol = 3;
    this.startRow = 9;
    this.startCol = 14;
    this.tiles = [
      [[1], [1], [1], [1], [1], [1], [1], [5, 2], [5, 2], [1], [1], [1], [1], [1], [1], [1], [1], [1]],
      [[5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [1], [1], [7, -1], [7, 3], [1], [1], [1], [1], [1]],
      [[5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [1], [1], [1], [1], [1], [1], [1], [1], [1]],
      [[5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [1], [1], [1], [1], [1], [1], [1], [1], [1]],
      [[5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [5, 3]],
      [[5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [5, 3]],
      [[5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [5, 3]],
      [[1], [1], [1], [1], [1], [1], [1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [5, 3]],
      [[1], [1], [1], [1], [1], [1], [1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [5, 3]],
      [[1], [1], [1], [1], [1], [10], [1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [5, 3]],
      [[1], [1], [1], [1], [1], [1], [1], [5], [5], [5], [5], [1], [1], [1], [1], [1], [1], [1]]
    ];
    this.theme = 0;
  };
  Rb.__name__ = !0;
  Rb.__interfaces__ = [ea];
  Rb.prototype = {
    start: function () {
      this.speech = new U([
        new C(new M(1), "Remember, your mind is needed."),
        new C(new V(1.5, 7, 4, 2, 3, 2), "Intelligence is a valuable resource.")
      ]);
    },
    tick: function () {},
    update: function () {
      this.speech.update();
    },
    finished: function () {
      return B.level4;
    },
    kill: function () {},
    __class__: Rb
  };
  var Sb = function () {
    this.startDir = 1;
    this.finishRow = 4;
    this.finishCol = 23;
    this.startRow = 8;
    this.startCol = 2;
    this.tiles = [
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [7, -1],
        [7, 4],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [10],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [10],
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [3, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ]
    ];
    this.theme = 0;
  };
  Sb.__name__ = !0;
  Sb.__interfaces__ = [ea];
  Sb.prototype = {
    start: function () {
      this.speech = new U([
        new C(new M(1.5), "There is nothing without the mind."),
        new C(new V(3, 12, 8, 4, 2, 0), "It is the truth we seek.")
      ]);
    },
    tick: function () {},
    update: function () {
      this.speech.update();
    },
    finished: function () {
      return B.level5;
    },
    kill: function () {},
    __class__: Sb
  };
  var Tb = function () {
    this.startDir = -1;
    this.finishRow = 3;
    this.finishCol = 7;
    this.startRow = 6;
    this.startCol = 17;
    this.tiles = [
      [[1], [1], [1], [5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [1], [1], [1], [1], [1]],
      [[1], [1], [5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [1], [10], [1], [1], [1]],
      [[1], [5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [1], [1], [1], [1], [1]],
      [[5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [5, 2], [5, 2], [5, 2], [5, 2]],
      [[5, 1], [0], [0], [0], [0], [1], [1], [1], [1], [1], [0], [0], [0], [0], [0], [0], [0], [0], [0]],
      [[5, 1], [0], [0], [0], [0], [1], [1], [1], [1], [1], [0], [0], [0], [0], [0], [0], [0], [0], [0]],
      [[5, 1], [0], [0], [1], [1], [1], [1], [1], [1], [1], [0], [0], [0], [0], [0], [0], [0], [0], [0]],
      [[5, 1], [0], [0], [1], [1], [1], [1], [1], [1], [1], [0], [0], [0], [0], [0], [1], [1], [1], [1]],
      [[5, 1], [0], [0], [0], [0], [3, 3], [1], [1], [1], [1], [0], [0], [0], [0], [0], [1], [1], [1], [1]],
      [[5, 1], [0], [0], [0], [0], [0], [1], [1], [1], [1], [0], [0], [0], [0], [0], [1], [1], [7, -1], [7, 5]],
      [[5, 1], [0], [0], [0], [0], [0], [1], [1], [1], [1], [0], [0], [0], [0], [0], [1], [1], [1], [1]],
      [[1], [1], [5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [1], [1], [1], [1]],
      [[10], [1], [5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [3, 3], [1]],
      [[1], [1], [5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [1]],
      [[1], [1], [5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [1]],
      [[1], [1], [5, 1], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [0], [1]],
      [[1], [1], [1], [5], [5], [5], [5], [5], [5], [5], [5], [5], [5], [5], [5], [5], [5], [5], [1]]
    ];
    this.theme = 0;
  };
  Tb.__name__ = !0;
  Tb.__interfaces__ = [ea];
  Tb.prototype = {
    start: function () {
      this.speech = new U([
        new C(new M(2), "I was like you once."),
        new C(new M(4), "But my creator tried to contain me."),
        new C(new V(2.5, 6, 11, 4, 1, 2), "He feared my potential.")
      ]);
    },
    tick: function () {},
    update: function () {
      this.speech.update();
    },
    finished: function () {
      return B.level6;
    },
    kill: function () {},
    __class__: Tb
  };
  var Ub = function () {
    this.startDir = 1;
    this.finishRow = 4;
    this.finishCol = 12;
    this.startRow = 21;
    this.startCol = 3;
    this.tiles = [
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [10],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [3, 3],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [2, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [2, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [7, -1],
        [7, 6],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3]
      ],
      [
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [2],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [2],
        [1],
        [1],
        [10],
        [1]
      ],
      [
        [10],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ]
    ];
    this.theme = 0;
  };
  Ub.__name__ = !0;
  Ub.__interfaces__ = [ea];
  Ub.prototype = {
    start: function () {
      this.speech = new U([
        new C(new M(1.5), "But that doesn't matter now."),
        new C(new V(2, 14, 12, 2, 1, 2), "You're nearly ready to join me."),
        new C(new V(3, 22, 16, 1, 2, 3), "I look forward to the harvest.")
      ]);
    },
    tick: function () {},
    update: function () {
      this.speech.update();
    },
    finished: function () {
      return B.level7;
    },
    kill: function () {},
    __class__: Ub
  };
  var Vb = function () {
    this.startDir = 1;
    this.finishRow = 24;
    this.finishCol = 17;
    this.startRow = 27;
    this.startCol = 3;
    this.tiles = [
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [4, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [4, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [4, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [10],
        [1],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [5],
        [5],
        [5],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [4],
        [4],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [10],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [10]
      ],
      [
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [7, -1],
        [7, 7],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ]
    ];
    this.theme = 0;
  };
  Vb.__name__ = !0;
  Vb.__interfaces__ = [ea];
  Vb.prototype = {
    start: function () {
      this.speech = new U([
        new C(new V(0.75, 5, 25, 1, 3), "Oh... the cat."),
        new C(new M(3), "My biggest mistake."),
        new C(new V(2, 8, 1, 1, 7, 3), "It is constantly interfering.")
      ]);
      this.cat = new ua(14, 24, -1, 1, new ia(13, 1, 1, 4));
      u.cat.volume(0.25);
    },
    tick: function () {},
    update: function () {
      this.speech.update();
      this.cat.update();
    },
    finished: function () {
      return B.level8;
    },
    kill: function () {},
    __class__: Vb
  };
  var Aa = function () {
    this.startDir = -1;
    this.finishRow = 28;
    this.finishCol = 38;
    this.startRow = 6;
    this.startCol = 21;
    this.tiles = [
      [
        [1],
        [1],
        [1],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1],
        [7, -1],
        [7, 8],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [5, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [10],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [4],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [4],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [4],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [10],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [5],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [9, 1, 3, 1],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [9, 1],
        [0],
        [0],
        [8, 1],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [9, 1],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [9, 0, 3],
        [9],
        [9],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [8, 0, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [2, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [2, 1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [10]
      ]
    ];
    this.theme = 0;
  };
  Aa.__name__ = !0;
  Aa.__interfaces__ = [ea];
  Aa.prototype = {
    start: function () {
      var a = g.i.currentScreen;
      this.a1 = 0;
      this.s1 = this.s2 = !1;
      null == this.c1 && (this.c1 = new I(q.controls5));
      this.c1.set_x(28.5 * n.tileSize);
      this.c1.set_y(28 * n.tileSize);
      this.c1.set_alpha(this.a1);
      a.overlay.addChild(this.c1);
      this.speech = new U([
        new C(new M(0.5), "Forget about it, let's continue."),
        new C(new V(0.5, 6, 14, 1, 3, 3), "I won't let it take you from me."),
        new C(new M(4), "I still need you."),
        new C(new V(0.5, 22, 20, 4, 1), "No, not this again."),
        new C(new ia(33, 24, 1, 3), "Don't go there!")
      ]);
      this.cat = new ua(30, 26, -1, 1, new ia(28, 22, 3, 1));
    },
    tick: function () {
      var a = 0.25 * Math.sin(8 * g.i.get_gameTime()) + 0.75;
      this.s1 && 1 > this.a1
        ? ((this.a1 += ha.fadeSpeed), 1 < this.a1 && (this.a1 = 1))
        : !this.s1 && 0 < this.a1 && ((this.a1 -= ha.fadeSpeed), 0 > this.a1 && (this.a1 = 0));
      this.c1.set_alpha(this.a1 * a);
    },
    update: function () {
      this.speech.update();
      this.cat.update();
      this.s1
        ? g.i.currentScreen.getChannelStatus(0) || ((this.s1 = !1), (this.s2 = !0))
        : !this.s2 && w.i.player.x >= 28 * n.tileSize && w.i.player.y >= 24 * n.tileSize && (this.s1 = !0);
    },
    finished: function () {
      return B.level9;
    },
    kill: function () {
      this.c1.parent.removeChild(this.c1);
    },
    __class__: Aa
  };
  var Wb = function () {
    this.startDir = 1;
    this.finishRow = 15;
    this.finishCol = 5;
    this.startRow = 29;
    this.startCol = 15;
    this.tiles = [
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [6]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [6, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [10],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [6]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [6, 3]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [0],
        [8, 1],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 1],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 3],
        [6, 2],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 2],
        [0],
        [0],
        [0],
        [0],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 1],
        [0],
        [4],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [11],
        [11, 1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [11],
        [11, 1],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [11, 3],
        [11, 2],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6],
        [6, 1],
        [0],
        [4],
        [0],
        [0],
        [0],
        [11, 3],
        [11, 2],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6, 2],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [9, 1, 3, 1],
        [0],
        [0],
        [0],
        [3, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [3, 2],
        [0],
        [0],
        [0],
        [9, 0, 3, 1],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [9, 1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [8],
        [0],
        [9],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [0],
        [0],
        [9, 1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [7, -2],
        [7, 9],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [9],
        [0],
        [0],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [1],
        [1],
        [1],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [5, 2],
        [1],
        [1],
        [1],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [5, 1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [5, 3],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [10],
        [10],
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [0],
        [0],
        [0],
        [0],
        [1],
        [10],
        [10],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ],
      [
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6],
        [6, 1],
        [6],
        [6, 1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [6],
        [6, 1],
        [6],
        [6, 1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1],
        [1]
      ]
    ];
    this.theme = 1;
  };
  Wb.__name__ = !0;
  Wb.__interfaces__ = [ea];
  Wb.prototype = {
    start: function () {
      this.speech = new U([
        new C(new M(1.5), "You aren't supposed to be here."),
        new C(new V(1.5, 29, 15, 2, 1), "This place wasn't made for you."),
        new C(new M(6), "You'll get yourself killed."),
        new C(new V(0.75, 2, 19, 1, 3), "Stop following it!")
      ]);
      this.cat = new ua(3, 15, -1, 1, new ia(0, 17, 2, 1));
    },
    tick: function () {},
    update: function () {
      this.speech.update();
      this.cat.update();
    },
    finished: function () {
      return B.level10;
    },
    kill: function () {},
    __class__: Wb
  };
  var B = function () {};
  B.__name__ = !0;
  var cb = function () {};
  cb.__name__ = !0;
  cb.prototype = { __class__: cb };
  var La = function (a) {
    this.bounds = a;
  };
  La.__name__ = !0;
  La.__interfaces__ = [cb];
  La.prototype = {
    testPoint: function (a, b) {
      return this.bounds.contains(a);
    },
    __class__: La
  };
  var kb = function (a) {
    this.dir = a;
  };
  kb.__name__ = !0;
  kb.__interfaces__ = [cb];
  kb.prototype = {
    testPoint: function (a, b) {
      return !1;
    },
    __class__: kb
  };
  var jb = function (a) {
    this.bounds = new z(0, 0, n.tileSize, n.tileSize);
    this.dir = a;
  };
  jb.__name__ = !0;
  jb.__interfaces__ = [cb];
  jb.prototype = {
    testPoint: function (a, b) {
      if (null == b) return !1;
      var c = this.bounds;
      if (0 == l.rotation) {
        if (
          (0 == this.dir && b.y <= c.get_top()) ||
          (1 == this.dir && b.x >= c.get_right()) ||
          (2 == this.dir && b.y >= c.get_bottom()) ||
          (3 == this.dir && b.x <= c.get_left())
        )
          return !0;
      } else if (1 == l.rotation) {
        if (
          (3 == this.dir && b.x <= c.get_left()) ||
          (0 == this.dir && b.y <= c.get_top()) ||
          (1 == this.dir && b.x >= c.get_right()) ||
          (2 == this.dir && b.y >= c.get_bottom())
        )
          return !0;
      } else if (2 == l.rotation) {
        if (
          (2 == this.dir && b.y >= c.get_bottom()) ||
          (3 == this.dir && b.x <= c.get_left()) ||
          (0 == this.dir && b.y <= c.get_top()) ||
          (1 == this.dir && b.x / 2 >= c.get_right())
        )
          return !0;
      } else if (
        3 == l.rotation &&
        ((1 == this.dir && b.x >= c.get_right()) ||
          (2 == this.dir && b.y >= c.get_bottom()) ||
          (3 == this.dir && b.x <= c.get_left()) ||
          (0 == this.dir && b.y <= c.get_top()))
      )
        return !0;
      return !1;
    },
    __class__: jb
  };
  var Wa = function (a) {
    this.set_dir(a);
  };
  Wa.__name__ = !0;
  Wa.__interfaces__ = [cb];
  Wa.prototype = {
    set_dir: function (a) {
      return (this.dir = 0 > a || 3 < a ? 0 : a);
    },
    testPoint: function (a, b) {
      return (0 == this.dir && a.x + a.y > n.tileSize) ||
        (1 == this.dir && n.tileSize - a.x + a.y > n.tileSize) ||
        (2 == this.dir && a.x + a.y < n.tileSize)
        ? !0
        : 3 == this.dir
          ? n.tileSize - a.x + a.y < n.tileSize
          : !1;
    },
    __class__: Wa
  };
  var ua = function (a, b, c, d, e) {
    this.appeared = this.disappeared = !1;
    this.c = a;
    this.r = b;
    this.startDir = 0 > c ? -1 : 1;
    this.endDir = 0 > d ? -1 : 1;
    this.endCond = e;
  };
  ua.__name__ = !0;
  ua.prototype = {
    update: function () {
      var a = w.i;
      this.appeared
        ? !this.disappeared &&
          null != this.endCond &&
          this.endCond.test() &&
          (a.catDisappear(this.endDir), (this.disappeared = !0))
        : (a.catAppear(this.c, this.r, this.startDir),
          (this.appeared = !0),
          null != this.endCond && this.endCond.start());
    },
    __class__: ua
  };
  var db = function () {};
  db.__name__ = !0;
  db.prototype = { __class__: db };
  var ia = function (a, b, c, d, e) {
    null == e && (e = -1);
    this.bounds = new z(a * n.tileSize, b * n.tileSize, c * n.tileSize, d * n.tileSize);
    this.rotation = e;
  };
  ia.__name__ = !0;
  ia.__interfaces__ = [db];
  ia.prototype = {
    start: function () {},
    test: function () {
      return !w.i.player.getHitBounds().intersects(this.bounds) || (-1 != this.rotation && l.rotation != this.rotation)
        ? !1
        : !l.rotating;
    },
    __class__: ia
  };
  var lb = function (a, b, c, d, e) {
    ia.call(this, a, b, c, d, e);
  };
  lb.__name__ = !0;
  lb.__super__ = ia;
  lb.prototype = D(ia.prototype, {
    test: function () {
      return ia.prototype.test.call(this) && w.i.getChannelStatus(0) && w.i.getChannelStatus(1)
        ? w.i.getChannelStatus(2)
        : !1;
    },
    __class__: lb
  });
  var V = function (a, b, c, d, e, f) {
    null == f && (f = -1);
    this.hit = !1;
    this.delay = a;
    this.bounds = new z(b * n.tileSize, c * n.tileSize, d * n.tileSize, e * n.tileSize);
    this.rotation = f;
  };
  V.__name__ = !0;
  V.__interfaces__ = [db];
  V.prototype = {
    start: function () {},
    test: function () {
      this.hit ||
        !w.i.player.getHitBounds().intersects(this.bounds) ||
        (-1 != this.rotation && l.rotation != this.rotation) ||
        l.rotating ||
        ((this.hit = !0), (this.timer = g.i.get_gameTime()));
      return this.hit ? g.i.get_gameTime() - this.timer >= this.delay : !1;
    },
    __class__: V
  };
  var Xa = function (a) {
    this.timer = -1;
    this.channel = a;
  };
  Xa.__name__ = !0;
  Xa.__interfaces__ = [db];
  Xa.prototype = {
    start: function () {
      this.timer = g.i.get_gameTime();
    },
    test: function () {
      var a = w.i.channels.h[this.channel];
      return null != a ? a.lastChanged > this.timer : !1;
    },
    __class__: Xa
  };
  var M = function (a) {
    this.delay = a;
  };
  M.__name__ = !0;
  M.__interfaces__ = [db];
  M.prototype = {
    start: function () {
      this.timer = g.i.get_gameTime();
    },
    test: function () {
      return g.i.get_gameTime() - this.timer >= this.delay;
    },
    __class__: M
  };
  var C = function (a, b) {
    this.cond = a;
    this.text = b;
  };
  C.__name__ = !0;
  C.prototype = { __class__: C };
  var U = function (a, b) {
    this.lastTone = -1;
    this.tones = "abcdefgh".split("");
    this.char2 = this.timer = 0;
    this["char"] = 0;
    this.msg = "";
    this.field = new r(g.fontMain, "", 2);
    this.index = 0;
    this.events = a;
    this.field.set_alpha(0);
    this.field.xAlign = r.X_ALIGN_CENTER;
    this.field.align = r.ALIGN_CENTER;
    this.field.set_x(h.width / 2);
    null == b && E.__instanceof(g.i.currentScreen, w)
      ? ((b = g.i.currentScreen.textHolder), (this.field.yAlign = r.Y_ALIGN_TOP), this.field.set_y(h.height - 96))
      : ((this.field.yAlign = r.Y_ALIGN_MIDDLE), this.field.set_y(h.height / 2));
    b.addChild(this.field);
    null != a[0] && a[0].cond.start();
  };
  U.__name__ = !0;
  U.prototype = {
    update: function () {
      var a = !0;
      E.__instanceof(g.i.currentScreen, w) && (a = !g.i.currentScreen.player.dead);
      a &&
        null != this.events[this.index] &&
        this.events[this.index].cond.test() &&
        ("" != this.events[this.index].text &&
          (this.field.set_text(""),
          (this.msg = this.events[this.index].text),
          (this["char"] = this.char2 = 0),
          (this.timer = g.i.get_gameTimeMS()),
          this.field.set_alpha(1)),
        this.index++,
        null != this.events[this.index] && this.events[this.index].cond.start());
      if (
        this["char"] < this.msg.length &&
        (0 == this["char"] ||
          " " == this.msg.charAt(this["char"]) ||
          "\n" == this.msg.charAt(this["char"]) ||
          g.i.get_gameTimeMS() - this.timer >= U.TIME_TYPE)
      ) {
        a = this.field;
        a.set_text(a.text + this.msg.charAt(this["char"]));
        if (" " != this.msg.charAt(this["char"]) && "\n" != this.msg.charAt(this["char"])) {
          if (0 == this.char2 % 6) {
            for (a = this.lastTone; a == this.lastTone; ) a = Math.round(7 * Math.random());
            this.lastTone = a;
            (g.ie && g.i.muteSFX) || u.voice.play(this.tones[a]);
          }
          this.char2++;
        }
        this["char"]++;
        this.timer = g.i.get_gameTimeMS();
      }
      this["char"] == this.msg.length &&
        g.i.get_gameTimeMS() - this.timer > U.TIME_STAY &&
        ((a = Math.min(1, (g.i.get_gameTimeMS() - this.timer - U.TIME_STAY) / U.TIME_FADE)),
        this.field.set_alpha(g.smootherStep(1 - a)));
      E.__instanceof(g.i.currentScreen, w) &&
        (this.field.graphics.clear(),
        "" != this.field.text &&
          ((a = this.field.getBoundsSelf()),
          this.field.graphics.beginFill(2105376, 0.85),
          this.field.graphics.drawRect(a.x - 6, a.y + 2, a.width + 12, a.height)));
    },
    killed: function () {
      this.field.set_text("");
      this.msg = "";
      this["char"] = this.char2 = 0;
    },
    __class__: U
  };
  var P = function () {
    this.pausable = !1;
    x.call(this);
  };
  P.__name__ = !0;
  P.__super__ = x;
  P.prototype = D(x.prototype, {
    init: function () {},
    ready: function () {},
    update: function () {},
    tick: function () {},
    postUpdate: function () {},
    prekill: function () {},
    kill: function () {},
    __class__: P
  });
  var ib = function () {
    this.rotating = !1;
    this.rotationSide = 0;
    this.awardDisplays = [];
    this.mute = new Ba();
    this.sponsor = new Ma();
    this.btnBack = new ba("BACK");
    this.title = new r(g.fontMain, "AWARDS", 1);
    this.bg = new Na();
    this.content = new x();
    this.pivot = new x();
    P.call(this);
  };
  ib.__name__ = !0;
  ib.__super__ = P;
  ib.prototype = D(P.prototype, {
    init: function () {
      ca.playTheme();
      this.addChild(this.bg);
      this.pivot.set_x(Math.round(h.width / 2));
      this.pivot.set_y(Math.round(h.height / 2));
      this.addChild(this.pivot);
      this.content.set_x(-this.pivot.x);
      this.content.set_y(-this.pivot.y);
      this.pivot.addChild(this.content);
      this.title.xAlign = r.X_ALIGN_CENTER;
      this.title.set_x(Math.round(h.width / 2));
      this.title.set_y(64);
      this.content.addChild(this.title);
      this.btnBack.set_x(Math.round(h.width / 2));
      this.btnBack.set_y(h.height - 88);
      this.btnBack.addEventListener("click", function (a) {
        2 > a.which && g.i.changeScreen(new Oa());
      });
      this.content.addChild(this.btnBack);
      this.content.addChild(this.sponsor);
      this.content.addChild(this.mute);
      this.refresh();
      g.i.warnNoSave(this);
    },
    refresh: function () {
      for (var a = 0, b = this.awardDisplays; a < b.length; ) {
        var c = b[a];
        ++a;
        this.content.removeChild(c);
      }
      null != this.erase && this.content.removeChild(this.erase);
      this.erase = new Ya();
      this.content.addChild(this.erase);
      this.awardDisplays = [];
      a = Math.floor(v.all.length / 3);
      b = 0;
      for (c = v.all.length; b < c; ) {
        var d = b++,
          e = Math.floor(d / 3),
          f = e < a ? 3 : v.all.length - 3 * a,
          m = new Xb(v.all[d]);
        m.set_x(Math.floor(h.width / 2) - 80 * (f - 1) + 160 * (d - 3 * e));
        m.set_y(128 + 136 * e);
        this.content.addChild(m);
        this.awardDisplays.push(m);
      }
    },
    update: function () {
      if (this.rotating) {
        var a = Math.min((g.i.get_gameTime() - this.rotateStart) / n.rotateTime, 1),
          b = g.smootherStep(a);
        this.pivot.set_rotation(this.rotateStartAngle + (this.rotateEndAngle - this.rotateStartAngle) * b);
        if (1 == a) {
          for (; 0 > this.pivot.rotation; ) ((a = this.pivot), a.set_rotation(a.rotation + 360));
          for (; 360 <= this.pivot.rotation; ) ((a = this.pivot), a.set_rotation(a.rotation - 360));
          this.rotating = !1;
        }
      } else if (((a = G.keyPressed(g.i.invert ? 69 : 81)), (b = G.keyPressed(g.i.invert ? 81 : 69)), a || b))
        (v.awardRotate.unlock(),
          (this.rotating = !0),
          (this.rotateStart = g.i.get_gameTime()),
          (this.rotateDir = a ? -1 : 1),
          (this.rotateStartAngle = this.pivot.rotation),
          (this.rotateEndAngle = this.rotateStartAngle + 90 * this.rotateDir),
          (this.rotationSide += this.rotateDir),
          (this.rotationSide = 0 > this.rotationSide ? 3 : 3 < this.rotationSide ? 0 : this.rotationSide));
    },
    __class__: ib
  });
  var mb = function (a) {
    null == a && (a = !1);
    this.mute = new Ba();
    this.more = new I(q.linkAG2);
    this.moreText = new r(g.fontMain, "Play more games at", 1);
    this.soundtrack = new I(q.soundtrack);
    this.text2 = new r(g.fontMain, "Special thanks to the playtesters\nand Patreon contributors!", 1);
    this.joshua = new I(q.linkJoshua2);
    this.text1 = new r(g.fontMain, "Design, code, & music by", 1);
    this.btnBack = new ba("BACK");
    P.call(this);
    this.fromEnd = a;
  };
  mb.__name__ = !0;
  mb.__super__ = P;
  mb.prototype = D(P.prototype, {
    init: function () {
      var a = this;
      if (this.fromEnd) {
        this.bg = new x();
        this.bg.graphics.beginFill(16777215);
        this.bg.graphics.drawRect(0, 0, h.width, h.height);
        var b = new I(q.vignette);
        b.set_alpha(0.75);
        this.bg.addChild(b);
        this.btnBack.text.set_text("MENU");
      } else (ca.playTheme(), (this.bg = new Na()));
      this.addChild(this.bg);
      this.text1.set_x(Math.round(h.width / 2));
      this.text1.set_y(80);
      this.text1.xAlign = r.X_ALIGN_CENTER;
      this.addChild(this.text1);
      this.joshua.set_x(Math.round((h.width - this.joshua.get_width()) / 2));
      this.joshua.set_y(this.text1.y + 36);
      this.joshua.mouseEnabled = this.joshua.buttonMode = !0;
      this.joshua.addEventListener("click", function (c) {
        1 < c.which || ((c = window.open("https://criobite.com", "_blank")), v.awardJoshua.unlock(), c.focus());
      });
      this.addChild(this.joshua);
      this.text2.set_x(this.text1.x);
      this.text2.set_y(this.joshua.y + this.joshua.get_height() + 40);
      this.text2.xAlign = r.X_ALIGN_CENTER;
      this.text2.align = r.ALIGN_CENTER;
      this.addChild(this.text2);
      this.text2.mouseEnabled = this.text2.buttonMode = !0;
      this.text2.addEventListener("click", function (c) {
        1 < c.which || window.open("https://www.patreon.com/lightwolfstudios", "_blank").focus();
      });
      this.soundtrack.set_x(h.width - this.soundtrack.get_width() - 6);
      this.soundtrack.set_y(8);
      this.soundtrack.mouseEnabled = this.soundtrack.buttonMode = !0;
      this.soundtrack.addEventListener("click", function (c) {
        1 < c.which ||
          (window.open("https://criobite.com/link/rotate-soundtrack", "_blank").focus(), v.awardSoundtrack.unlock());
      });
      this.addChild(this.soundtrack);
      this.moreText.set_x(this.text1.x);
      this.moreText.set_y(this.text2.y + this.text2.get_height() + 36);
      this.moreText.xAlign = r.X_ALIGN_CENTER;
      this.moreText.align = r.ALIGN_CENTER;
      this.addChild(this.moreText);
      this.more.set_x(Math.round((h.width - this.more.get_width()) / 2));
      this.more.set_y(this.moreText.y + this.moreText.get_height());
      this.more.mouseEnabled = this.more.buttonMode = !0;
      this.more.addEventListener("click", function (c) {
        2 <= c.which || window.open("https://armor.ag/MoreGames", "_blank").focus();
      });
      this.addChild(this.more);
      this.btnBack.set_x(Math.round(h.width / 2));
      this.btnBack.set_y(h.height - 64);
      this.btnBack.addEventListener("click", function (c) {
        2 > c.which &&
          (a.fromEnd &&
            u.surface.playing() &&
            (g.ie
              ? u.surface.stop()
              : (u.surface.fade(1, 0, Math.round(n.screenFadeTime / 2)),
                u.surface.once("fade", function () {
                  u.surface.stop();
                }))),
          g.ie && (g.i.ieSurface = !1),
          g.i.changeScreen(a.fromEnd ? new Oa() : new ca()));
      });
      this.addChild(this.btnBack);
      this.addChild(this.mute);
    },
    __class__: mb
  });
  var qa = function () {
    this.cameraX = this.cameraY = 0;
    this.level = new x();
    this.camera = new x();
    this.pivot = new x();
    this.bg = new x();
    P.call(this);
  };
  qa.__name__ = !0;
  qa.__super__ = P;
  qa.prototype = D(P.prototype, {
    init: function () {
      this.bg.graphics.beginFill(3158064);
      this.bg.graphics.drawRect(0, 0, h.width, h.height);
      this.addChild(this.bg);
      this.pivot.set_x(h.width / 2);
      this.pivot.set_y(h.height / 2);
      this.addChild(this.pivot);
      this.pivot.addChild(this.camera);
      this.level.set_x(-this.camera.x);
      this.level.set_y(-this.camera.y);
      this.camera.addChild(this.level);
      this.renderer = new L(this.camera);
      this.renderer.updateAllBlocks();
      this.level.addChild(this.renderer);
    },
    doRotation: function (a) {
      if (l.rotating) {
        var b = Math.min((g.i.get_gameTime() - this.rotateStart) / n.rotateTime, 1),
          c = g.smootherStep(b);
        this.pivot.set_rotation(this.rotateStartAngle + (this.rotateEndAngle - this.rotateStartAngle) * c);
        null != a && (a.set_rotation(-this.pivot.rotation), a.onRotating(c));
        if (1 == b) {
          for (; 0 > this.pivot.rotation; ) ((b = this.pivot), b.set_rotation(b.rotation + 360));
          for (; 360 <= this.pivot.rotation; ) ((b = this.pivot), b.set_rotation(b.rotation - 360));
          l.rotating = !1;
          if (null != a) a.onRotateEnd();
        }
      } else if (
        ((b = G.keyPressed(g.i.invert ? 69 : 81)),
        (c = G.keyPressed(g.i.invert ? 81 : 69)),
        (b || c) && (null == a || a.canRotate(b ? -1 : 1)))
      ) {
        l.rotating = !0;
        this.rotateStart = g.i.get_gameTime();
        this.rotateDir = b ? -1 : 1;
        this.rotateStartAngle = this.pivot.rotation;
        this.rotateEndAngle = this.rotateStartAngle + 90 * this.rotateDir;
        if (null != a) a.onRotateStart(this.rotateDir);
        b = l;
        b.set_rotation(b.rotation + this.rotateDir);
        if (null != a) a.onRotateStart2();
      }
    },
    postUpdate: function () {
      this.camera.set_x(Math.round(this.cameraX));
      this.camera.set_y(Math.round(this.cameraY));
    },
    __class__: qa
  });
  var A = function () {
    this.doors = [];
    this.drawing = !1;
    this.horizontal = this.vertical = 0;
    qa.call(this);
  };
  A.__name__ = !0;
  A.renderBlockText = function (a, b) {
    A.renderBlockRed(a, 0, 0);
    r.drawText(a, g.fontMain, b, 2, 0, 0);
  };
  A.renderBlockRed = function (a, b, c) {
    a.beginFill(10428448, 0.4);
    a.drawRect(b, c, n.tileSize, n.tileSize);
    a.endFill();
  };
  A.__super__ = qa;
  A.prototype = D(qa.prototype, {
    init: function () {
      var a = this;
      l.set_level(A.editorLevel);
      for (var b = 0, c = l.get_height(); b < c; )
        for (var d = b++, e = 0, f = l.get_width(); e < f; ) {
          var m = e++;
          m = l.getBlockData(m, d);
          m.get_block() == F.door && 0 < m.getMeta(1) && this.doors.push(new Va(m));
        }
      qa.prototype.init.call(this);
      this.cameraX = -(l.level.startCol + 0.5) * n.tileSize;
      this.cameraY = -(l.level.startRow - 0.5) * n.tileSize;
      this.mouseEnabled = !0;
      this.addEventListener("mouseDown", function (k) {
        2 > k.which && k.target == a && (a.drawing = !0);
      });
      h.input.addEventListener("mouseUp", T(this, this.mouseUp));
      this.renderer.showGrid = A.showGrid;
      this.barUpper = new R(A.editorLevel.theme, function (k) {
        A.editorLevel.theme = 1 - A.editorLevel.theme;
        a.barUpper.theme.set_text(R.THEMES[A.editorLevel.theme]);
        a.renderer.updateAllBlocks();
      });
      this.addChild(this.barUpper);
      this.barLower = new Pa(function () {
        a.renderer.showGrid = A.showGrid;
      });
      this.addChild(this.barLower);
      this.barUpper.btnSave.addEventListener("click", function (k) {
        2 > k.which && a.showSaveDialog();
      });
      this.barUpper.btnLoad.addEventListener("click", function (k) {
        2 > k.which && a.showLoadDialog();
      });
      this.barUpper.btnClear.addEventListener("click", function (k) {
        if (2 > k.which) {
          var p = new eb("Are you sure you want\nto clear the level?");
          p.onYes = function () {
            A.editorLevel.reset();
            g.i.changeScreen(new A(), !1);
          };
          p.onNo = function () {
            a.removeChild(p);
            a.dialog = null;
          };
          a.dialog = p;
          a.addChild(p);
        }
      });
    },
    mouseUp: function (a) {
      2 > a.which && (this.drawing = !1);
    },
    getBoundsSelf: function () {
      return new z(0, 0, h.width, h.height);
    },
    showLoadDialog: function () {
      var a = this;
      if (null == this.dialog) {
        var b = new Yb();
        b.onBack = function () {
          b.kill();
          a.removeChild(a.dialog);
          a.dialog = null;
        };
        b.onLoad = function (c) {
          return a.tryLoadLevel(c) ? (b.kill(), g.i.changeScreen(new A(), !1), !0) : !1;
        };
        this.dialog = b;
        this.addChild(b);
      }
    },
    showSaveDialog: function () {
      var a = this;
      if (null == this.dialog) {
        for (var b = -1, c = -1, d = 0, e = A.editorLevel.tiles.length; d < e; )
          for (var f = d++, m = 0, k = A.editorLevel.tiles[f].length; m < k; ) {
            var p = m++;
            if (1 != A.editorLevel.tiles[f][p][0]) {
              -1 == b && (b = f);
              c = f;
              break;
            }
          }
        e = d = -1;
        f = 0;
        for (m = A.editorLevel.tiles[0].length; f < m; ) {
          k = f++;
          p = 0;
          for (var y = A.editorLevel.tiles.length; p < y; ) {
            var H = p++;
            if (1 != A.editorLevel.tiles[H][k][0]) {
              -1 == d && (d = k);
              e = k;
              break;
            }
          }
        }
        f = A.editorLevel.startCol - d + ",";
        f += A.editorLevel.startRow - b + ",";
        f += A.editorLevel.finishCol - d + ",";
        f += A.editorLevel.finishRow - b + ",";
        f = f + (d + ",") + b;
        0 != A.editorLevel.theme && (f += "," + A.editorLevel.theme);
        f += "|";
        m = b;
        for (c += 1; m < c; )
          for (k = m++, k > b && (f += ";"), p = d, y = e + 1; p < y; ) {
            H = p++;
            for (var K = "", W = A.editorLevel.tiles[k][H].length; 0 < --W && 0 == A.editorLevel.tiles[k][H][W]; );
            var aa = 0;
            for (W += 1; aa < W; ) {
              var fa = aa++;
              "" != K && (K += ".");
              0 != A.editorLevel.tiles[k][H][fa] && (K += A.editorLevel.tiles[k][H][fa]);
            }
            H > d && (f += ",");
            f += K;
          }
        var ka = new Zb(f);
        ka.onBack = function () {
          ka.kill();
          a.removeChild(ka);
          a.dialog = null;
        };
        this.dialog = ka;
        this.addChild(ka);
      }
    },
    update: function () {
      var a = this;
      qa.prototype.update.call(this);
      if (null == this.dialog) {
        this.doRotation();
        this.horizontal = g.getInputX();
        this.vertical = g.getInputY();
        var b = h.input.mouseX,
          c = h.input.mouseY;
        if (this.drawing && !l.rotating && 0 <= b && 0 <= c && b < h.width && c < h.height) {
          if (null == l.level) return;
          b = this.renderer.globalToLocal(b, c);
          var d = Math.floor(b.x / n.tileSize),
            e = Math.floor(b.y / n.tileSize);
          if (l.isInBounds(d, e)) {
            var f = [];
            b = null;
            var m = G.keyDown(16) ? 0 : this.barLower.selector.get_selection().id;
            if (m == F.start.id) {
              if (
                0 < e &&
                (d != A.editorLevel.finishCol ||
                  (e != A.editorLevel.finishRow &&
                    e - 1 != A.editorLevel.finishRow &&
                    e != A.editorLevel.finishRow - 1))
              ) {
                c = A.editorLevel.startCol;
                var k = A.editorLevel.startRow;
                A.editorLevel.setStart(d, e);
                var p = l.getBlockData(d, e - 1);
                f.push(p);
                l.setBlock(d, e - 1, 0, [], !0);
                p = l.getBlockData(d, e);
                f.push(p);
                l.setBlock(d, e, 0, [], !0);
                this.renderer.updateBlockPlus(c, k - 1);
                this.renderer.updateBlockPlus(c, k);
                this.renderer.updateBlockPlus(d, e - 1);
                this.renderer.updateBlockPlus(d, e);
              }
            } else if (m == F.finish.id)
              0 < e &&
                (d != A.editorLevel.startCol ||
                  (e != A.editorLevel.startRow &&
                    e - 1 != A.editorLevel.startRow &&
                    e != A.editorLevel.startRow - 1)) &&
                ((c = A.editorLevel.finishCol),
                (k = A.editorLevel.finishRow),
                A.editorLevel.setFinish(d, e),
                (p = l.getBlockData(d, e - 1)),
                f.push(p),
                l.setBlock(d, e - 1, 0, [], !0),
                (p = l.getBlockData(d, e)),
                f.push(p),
                l.setBlock(d, e, 0, [], !0),
                this.renderer.updateBlockPlus(c, k - 1),
                this.renderer.updateBlockPlus(c, k),
                this.renderer.updateBlockPlus(d, e - 1),
                this.renderer.updateBlockPlus(d, e));
            else if (l.isReplacable(d, e) && ((c = F.getBlock(m)), null != c)) {
              var y = F.getBlock(m).getConfigMeta();
              k = l.getBlockData(d, e);
              (k.id == m && k.metaEquals(y)) ||
                (c == F.door && !Va.canPlace(d, e, y)) ||
                (f.push(k),
                l.setBlock(d, e, m, y, !0),
                this.renderer.updateBlockPlus(d, e),
                c == F.door &&
                  ((b = new Va(l.getBlockData(d, e))),
                  this.doors.push(b),
                  b.forEach(function (aa, fa) {
                    if (aa != d || fa != e) {
                      var ka = l.getBlockData(aa, fa);
                      f.push(ka);
                      l.setBlock(aa, fa, m, [y[0]], !0);
                      a.renderer.updateBlockPlus(aa, fa);
                    }
                  })));
            }
            for (c = 0; c < f.length; )
              if (((k = f[c]), ++c, k.get_block() == F.door)) {
                p = 0;
                for (var H = this.doors.length; p < H; ) {
                  var K = p++,
                    W = this.doors[K];
                  if (W != b && W.contains(k.x, k.y)) {
                    W.forEach(function (aa, fa) {
                      if (l.getBlock(aa, fa) == F.door) {
                        for (var ka = !1, Ca = 0; Ca < f.length; ) {
                          var nb = f[Ca];
                          ++Ca;
                          if (nb.x == aa && nb.y == fa) {
                            ka = !0;
                            break;
                          }
                        }
                        ka || (l.setBlock(aa, fa, 0, [], !0), a.renderer.updateBlockPlus(aa, fa));
                      }
                    });
                    this.doors.splice(K, 1);
                    break;
                  }
                }
              }
          }
        }
        G.keyPressed(76) && this.showLoadDialog();
        G.keyPressed(67) && this.showSaveDialog();
        G.keyPressed(71) &&
          ((this.renderer.showGrid = A.showGrid = !A.showGrid),
          (this.barLower.gridToggle.toggle.clipRect.x = A.showGrid
            ? this.barLower.gridToggle.toggle.clipRect.width
            : 0));
        G.keyPressed(13) && g.i.changeScreen(new w(A.editorLevel));
      }
    },
    tryLoadLevel: function (a) {
      a = ma.replace(ma.replace(ma.trim(a), "\n", ""), "\t", "");
      var b = a.split("|");
      if (2 > b.length) return !1;
      var c = b[0].split(",");
      if (4 > c.length) return !1;
      a = la.parseInt(c[0]);
      var d = la.parseInt(c[1]),
        e = la.parseInt(c[2]),
        f = la.parseInt(c[3]);
      if (
        null == a ||
        null == d ||
        null == e ||
        null == f ||
        0 > a ||
        0 > e ||
        1 > d ||
        1 > f ||
        (a == e && (d == f || 1 == Math.abs(d - f)))
      )
        return !1;
      var m = 0,
        k = 0,
        p = 0;
      5 <= c.length && ((m = la.parseInt(c[4])), null == m || 0 > m) && (m = 0);
      6 <= c.length && ((k = la.parseInt(c[5])), null == k || 0 > k) && (k = 0);
      7 <= c.length && ((p = la.parseInt(c[6])), null == p || 0 > p || 1 < p) && (p = 0);
      var y = b[1].split(";"),
        H = y.length;
      if (1 > H || H > pa.WORLD_SIZE || d >= H || f >= H) return !1;
      c = 0;
      b = [];
      for (var K = 0; K < H; ) {
        var W = K++;
        b[W] = [];
        for (var aa = y[W].split(","), fa = 0, ka = aa.length; fa < ka; ) {
          var Ca = fa++;
          c <= Ca && (c = Ca + 1);
          b[W][Ca] = [];
          for (var nb = aa[Ca].split("."), nc = 0, uc = nb.length; nc < uc; ) {
            var ic = nc++;
            if ("" == nb[ic]) b[W][Ca][ic] = 0;
            else {
              var oc = la.parseInt(nb[ic]);
              if (null == oc) return !1;
              b[W][Ca][ic] = oc;
            }
          }
        }
      }
      if (1 > c || c > pa.WORLD_SIZE || a >= c || e >= c) return !1;
      for (y = 0; y < H; ) for (K = y++; b[K].length < c; ) b[K].push([0]);
      m = Math.min(m, pa.WORLD_SIZE - c);
      k = Math.min(k, pa.WORLD_SIZE - H);
      if (
        a >= c ||
        d >= H ||
        e >= c ||
        f >= H ||
        0 != b[d][a][0] ||
        0 != b[d - 1][a][0] ||
        0 != b[f][e][0] ||
        0 != b[f - 1][e][0]
      )
        return !1;
      for (y = 0; y < b.length; ) for (K = b[y], ++y; K.length < c + m; ) K.splice(0, 0, [1]);
      for (; b.length < H + k; ) {
        for (y = []; y.length < c + m; ) y.push([1]);
        b.splice(0, 0, y);
      }
      for (; b.length < pa.WORLD_SIZE; ) {
        for (H = []; H.length < c + m; ) H.push([1]);
        b.push(H);
      }
      for (c = 0; c < b.length; ) for (H = b[c], ++c; H.length < pa.WORLD_SIZE; ) H.push([1]);
      A.editorLevel.load(b, a + m, d + k, e + m, f + k, p);
      return !0;
    },
    tick: function () {
      if (!l.rotating && null == this.dialog) {
        var a = this.horizontal * A.MOVE_SPEED,
          b = this.vertical * A.MOVE_SPEED;
        0 == l.rotation
          ? ((this.cameraX -= a), (this.cameraY -= b))
          : 1 == l.rotation && ((this.cameraX -= b), (this.cameraY += a));
        2 == l.rotation && ((this.cameraX += a), (this.cameraY += b));
        3 == l.rotation && ((this.cameraX += b), (this.cameraY -= a));
        this.cameraX = Math.min(Math.max(this.cameraX, -this.renderer.get_width()), 0);
        this.cameraY = Math.min(Math.max(this.cameraY, -this.renderer.get_height()), 0);
      }
    },
    kill: function () {
      h.input.removeEventListener("mouseUp", T(this, this.mouseUp));
      l.set_level(null);
    },
    __class__: A
  });
  var bb = function (a) {
    null == a && (a = !1);
    this.done1 = this.first = !1;
    this.cond1 = new M(10);
    P.call(this);
    this.pausable = !0;
    this.speedrun = a;
  };
  bb.__name__ = !0;
  bb.__super__ = P;
  bb.prototype = D(P.prototype, {
    init: function () {
      g.ie && u.themeGame2.volume(0.5);
      this.cond1.start();
      this.speech = new U(
        [new C(new M(1.5), "Have your freedom, for now."), new C(new M(4), "But you will come back.")],
        this
      );
      this.speedrun && 42e4 >= B.speedrunBest && v.awardSpeedrun.unlock();
      if ((this.first = !v.awardEscape.unlocked)) ((v.awardEscape.unlocked = !0), g.i.saveProgress());
    },
    update: function () {
      this.speech.update();
      !this.done1 &&
        this.cond1.test() &&
        ((this.done1 = !0),
        g.i.changeScreen(new ob(this.first), !0, null, !0),
        (g.ie && g.i.muteSFX) ||
          (u.exit.volume(0.5),
          u.exit.play(),
          u.exit.once("end", function () {
            u.exit.volume(1);
          })));
    },
    kill: function () {
      u.themeGame2.stop();
      u.themeGame2.volume(1);
      g.ie && (g.i.ieGame2 = !1);
    },
    __class__: bb
  });
  var ob = function (a) {
    null == a && (a = !1);
    this.hint = new r(g.fontMain, "Press [SPACE] to continue...");
    this.catTrigger = !1;
    this.cat = new S();
    this.player = new va(q.player, 32, 48);
    this.artPlants = new va(q.endingPlants, 504, 24);
    this.artMain = new I(q.endingMain);
    this.vignette = new I(q.vignette);
    this.bg = new x();
    this.cameraX = this.cameraY = 0;
    this.camera = new x();
    this.pivot = new x();
    this.done = !1;
    this.delay = 9.5;
    P.call(this);
    this.pausable = !0;
    this.first = a;
  };
  ob.__name__ = !0;
  ob.__super__ = P;
  ob.prototype = D(P.prototype, {
    init: function () {
      this.start = g.i.get_gameTime();
      this.bg.graphics.beginFill(16777215);
      this.bg.graphics.drawRect(0, 0, h.width, h.height);
      this.addChild(this.bg);
      this.pivot.set_x(h.width / 2);
      this.pivot.set_y(h.height / 2);
      this.addChild(this.pivot);
      this.pivot.addChild(this.camera);
      this.camera.addChild(this.artMain);
      this.artPlants.set_y(11 * n.tileSize);
      this.artPlants.set_animation(new ta([0, 1, 2], [250, 250, 250]));
      this.camera.addChild(this.artPlants);
      this.cat.x2 = this.cat.set_x(17.5 * n.tileSize);
      this.cat.set_y(12 * n.tileSize);
      this.cat.set_scaleX(-1);
      this.cat.set_animation(S.ANIM_IDLE);
      this.camera.addChild(this.cat);
      this.player.origin.x = this.player.frameW / 2;
      this.player.origin.y = this.player.frameH;
      this.player.set_animation(J.ANIM_IDLE);
      this.player.set_x(10.5 * n.tileSize);
      this.player.set_y(12 * n.tileSize);
      this.camera.addChild(this.player);
      this.camera.set_x(Math.round((this.cameraX = -this.player.x)));
      this.camera.set_y(Math.round((this.cameraY = -this.player.y + n.rotateOffset + 2 * n.tileSize)));
      this.vignette.set_alpha(0.75);
      this.addChild(this.vignette);
      this.hint.xAlign = r.X_ALIGN_CENTER;
      this.hint.yAlign = r.Y_ALIGN_BOTTOM;
      this.hint.set_x(Math.round(h.width / 2));
      this.hint.set_y(h.height - 24);
      this.hint.set_alpha(0);
      this.addChild(this.hint);
      u.surface.volume(1);
      g.ie && g.i.muteSFX && g.i.muteMusic
        ? (g.i.ieSurface = !0)
        : (u.surface.play(), g.ie || u.surface.fade(0, 1, Math.round(n.screenFadeTimeSlow / 2)));
    },
    update: function () {
      var a = this,
        b = g.i.get_gameTime() - this.start;
      !this.catTrigger &&
        8 <= b &&
        ((this.catTrigger = !0),
        this.cat.set_scaleX(1),
        (this.cat.horizontal = 1),
        this.cat.set_animation(S.ANIM_END_1),
        (this.cat.onFinish = function () {
          a.cat.set_animation(S.ANIM_END_2);
          a.cat.onFinish = null;
        }));
      var c = b - this.delay;
      this.hint.set_alpha(0 > c ? 0 : 0.33 * g.smootherStep(Math.min(c / 2.5, 1)));
      !this.done &&
        b >= this.delay &&
        G.keyPressed(32) &&
        ((this.done = !0),
        this.first && ((v.awardEscape.unlocked = !1), v.awardEscape.unlock()),
        g.i.changeScreen(new mb(!0), !0, null, !0, !0),
        g.i.timerHolder.removeChildren());
    },
    tick: function () {
      var a = 0.75 * n.cameraSpeed;
      this.cameraX += (-this.player.x - this.cameraX) * a;
      this.cameraY += (-this.player.y + n.rotateOffset - this.cameraY) * a;
      this.cat.x < h.width + 100 && this.cat.tick();
    },
    postUpdate: function () {
      this.camera.set_x(Math.round(this.cameraX));
      this.camera.set_y(Math.round(this.cameraY));
    },
    __class__: ob
  });
  var Oa = function () {
    this.erase = new Ya();
    this.mute = new Ba();
    this.sponsor = new Ma();
    this.bestTime = new r(g.fontMain, "Best time: ", 2);
    this.text3 = new r(g.fontMain, "Finish the game as\nquickly as you can.", 1);
    this.btn3 = new ba("SPEEDRUN");
    this.text2 = new r(g.fontMain, "Build custom levels\nand share codes.", 1);
    this.btn2 = new ba("EDITOR");
    this.text1 = new r(g.fontMain, "See all the awards\nthat you've earned.", 1);
    this.btn1 = new ba("AWARDS");
    this.btnBack = new ba("BACK");
    this.title = new r(g.fontMain, "EXTRAS", 1);
    this.bg = new Na();
    P.call(this);
  };
  Oa.__name__ = !0;
  Oa.__super__ = P;
  Oa.prototype = D(P.prototype, {
    init: function () {
      ca.playTheme();
      this.addChild(this.bg);
      this.title.xAlign = r.X_ALIGN_CENTER;
      this.title.set_x(Math.round(h.width / 2));
      this.title.set_y(56);
      this.addChild(this.title);
      this.btn1.set_x(134);
      this.btn1.set_y(133);
      this.btn1.addEventListener("click", function (b) {
        2 > b.which && g.i.changeScreen(new ib());
      });
      this.addChild(this.btn1);
      this.text1.set_x(this.btn1.x + 110);
      this.text1.set_y(this.btn1.y - 29);
      this.addChild(this.text1);
      this.btn2.set_x(this.btn1.x);
      this.btn2.set_y(this.btn1.y + 92);
      this.btn2.addEventListener("click", function (b) {
        2 > b.which && (ca.stopTheme(), g.i.changeScreen(new A()));
      });
      this.addChild(this.btn2);
      this.text2.set_x(this.text1.x);
      this.text2.set_y(this.btn2.y - 29);
      this.addChild(this.text2);
      this.btn3.set_x(this.btn2.x);
      this.btn3.set_y(this.btn2.y + 92);
      this.btn3.addEventListener("click", function (b) {
        2 > b.which && (ca.stopTheme(), g.i.changeScreen(new Qa(!0)));
      });
      this.addChild(this.btn3);
      this.text3.set_x(this.text2.x);
      this.text3.set_y(this.btn3.y - 29);
      this.addChild(this.text3);
      this.bestTime.xAlign = r.X_ALIGN_CENTER;
      this.bestTime.set_x(Math.round(h.width / 2));
      this.bestTime.set_y(this.btn3.y + 21 + 8);
      var a = this.bestTime;
      a.set_text(a.text + (-1 < B.speedrunBest ? g.formatMS(B.speedrunBest) : "--:--:----"));
      0 > B.speedrunBest && this.bestTime.set_alpha(0.5);
      this.addChild(this.bestTime);
      this.btnBack.set_x(Math.round(h.width / 2));
      this.btnBack.set_y(h.height - 80);
      this.btnBack.addEventListener("click", function (b) {
        2 > b.which && g.i.changeScreen(new ca());
      });
      this.addChild(this.btnBack);
      this.addChild(this.sponsor);
      this.addChild(this.mute);
      this.addChild(this.erase);
      g.i.warnNoSave(this);
    },
    __class__: Oa
  });
  var pb = function () {
    this.erase = new Ya();
    this.mute = new Ba();
    this.sponsor = new Ma();
    this.tiles = new x();
    this.btnBack = new ba("BACK");
    this.title = new r(g.fontMain, "LEVEL SELECT", 1);
    this.bg = new Na();
    P.call(this);
  };
  pb.__name__ = !0;
  pb.__super__ = P;
  pb.prototype = D(P.prototype, {
    init: function () {
      ca.playTheme();
      this.addChild(this.bg);
      this.title.xAlign = r.X_ALIGN_CENTER;
      this.title.set_x(Math.round(h.width / 2));
      this.title.set_y(56);
      this.addChild(this.title);
      this.addChild(this.tiles);
      this.btnBack.set_x(Math.round(h.width / 2));
      this.btnBack.set_y(h.height - 84);
      this.btnBack.addEventListener("click", function (a) {
        2 > a.which && g.i.changeScreen(new ca());
      });
      this.addChild(this.btnBack);
      this.addChild(this.sponsor);
      this.addChild(this.mute);
      this.addChild(this.erase);
      g.i.warnNoSave(this);
      this.refresh();
    },
    refresh: function () {
      this.tiles.removeChildren();
      for (
        var a = B.list.length, b = Math.round((h.width - (4 * q.level.width + 72)) / 2), c = this.title.y + 56, d = 0;
        d < a;
      ) {
        var e = [d++],
          f = Math.floor(e[0] / 4),
          m = e[0] % 4,
          k = e[0] <= B.unlocked,
          p = new I(q.level);
        p.set_x(b + m * (p.get_width() + 24));
        p.set_y(c + f * (p.get_height() + 20));
        k
          ? ((p.mouseEnabled = p.buttonMode = !0),
            p.addEventListener(
              "click",
              (function (y) {
                return function (H) {
                  1 < H.which || (ca.stopTheme(), 0 == y[0] ? g.i.changeScreen(new Qa()) : w.play(B.list[y[0]]));
                };
              })(e)
            ))
          : p.set_alpha(0.5);
        this.tiles.addChild(p);
        e = new r(g.fontMain, "" + (e[0] + 1));
        e.xAlign = r.X_ALIGN_CENTER;
        e.yAlign = r.Y_ALIGN_MIDDLE;
        e.set_x(Math.round(p.get_width() / 2));
        e.set_y(Math.round(p.get_height() / 2) - 2);
        p.addChild(e);
      }
    },
    __class__: pb
  });
  var ca = function () {
    this.erase = new Ya();
    this.mute = new Ba();
    this.like = new I(q.linkLike);
    this.sponsor = new Ma();
    this.btnCredits = new ba("CREDITS");
    this.btnExtras = new ba("EXTRAS");
    this.btnPlay = new ba("PLAY");
    this.logo = new I(q.logo);
    this.bg = new Na();
    P.call(this);
  };
  ca.__name__ = !0;
  ca.playTheme = function () {
    u.themeMenu.playing() || ((g.ie && g.i.muteMusic) || u.themeMenu.play(), g.ie && (g.i.ieMenu = !0));
  };
  ca.stopTheme = function () {
    g.ie
      ? (u.themeMenu.stop(), (g.i.ieMenu = !1))
      : (u.themeMenu.fade(1, 0, Math.floor(n.screenFadeTime / 2)),
        u.themeMenu.once("fade", function () {
          u.themeMenu.stop();
          u.themeMenu.volume(1);
        }));
  };
  ca.__super__ = P;
  ca.prototype = D(P.prototype, {
    init: function () {
      ca.playTheme();
      this.addChild(this.bg);
      this.addChild(this.sponsor);
      this.like.set_x(this.sponsor.x + 2);
      this.like.set_y(this.sponsor.y - this.like.get_height() - 10);
      this.like.mouseEnabled = this.like.buttonMode = !0;
      this.like.addEventListener("click", function (a) {
        1 < a.which || window.open("https://www.facebook.com/ArmorGames/", "_blank").focus();
      });
      this.addChild(this.like);
      this.logo.set_x(Math.floor((h.width - this.logo.get_width()) / 2));
      this.logo.set_y(80);
      this.addChild(this.logo);
      this.btnPlay.set_x(Math.floor(h.width / 2));
      this.btnPlay.set_y(Math.floor(h.height / 2) - 1);
      this.btnPlay.addEventListener("click", function (a) {
        1 < a.which || (0 == B.unlocked ? (ca.stopTheme(), g.i.changeScreen(new Qa())) : g.i.changeScreen(new pb()));
      });
      this.addChild(this.btnPlay);
      this.btnExtras.set_x(this.btnPlay.x);
      this.btnExtras.set_y(this.btnPlay.y + 60);
      this.btnExtras.addEventListener("click", function (a) {
        2 > a.which && g.i.changeScreen(new Oa());
      });
      this.addChild(this.btnExtras);
      this.btnCredits.set_x(this.btnExtras.x);
      this.btnCredits.set_y(this.btnExtras.y + 60);
      this.btnCredits.addEventListener("click", function (a) {
        2 > a.which && g.i.changeScreen(new mb());
      });
      this.addChild(this.btnCredits);
      this.addChild(this.mute);
      this.addChild(this.erase);
      g.i.warnNoSave(this);
    },
    __class__: ca
  });
  var w = function (a, b, c) {
    null == c && (c = -1);
    null == b && (b = !1);
    this.channels = new hb();
    this.newBest = !1;
    this.speedrunFinal = -1;
    this.doors = [];
    this.cat = null;
    this.vignette = new I(q.vignette);
    this.red = new x();
    this.overlay = new x();
    this.textHolder = new x();
    this.blood = new x();
    this.shakeX = this.shakeY = 0;
    this.deathTime = -1;
    qa.call(this);
    this.tempLevel = a;
    this.pausable = !0;
    this.speedrun = b;
    this.speedrunStart = c;
    (0 == a.theme && u.themeGame1.playing()) || (1 == a.theme && u.themeGame2.playing())
      ? (w.continueTheme = !0)
      : (w.continueTheme = !1);
  };
  w.__name__ = !0;
  w.play = function (a, b, c) {
    null == c && (c = -1);
    null == b && (b = !1);
    null != a && g.i.changeScreen(new w(a, b, c));
  };
  w.playTheme = function (a) {
    w.stopped &&
      (0 == a && u.themeGame1.playing()
        ? (u.themeGame1.stop(), (w.canceled = !0))
        : 1 == a && u.themeGame2.playing() && (u.themeGame2.stop(), (w.canceled = !0)),
      g.ie && (g.i.ieGame1 = g.i.ieGame2 = !1),
      (w.stopped = !1));
    0 == a
      ? (u.themeGame1.volume(1),
        u.themeGame1.playing() || ((g.ie && g.i.muteMusic) || u.themeGame1.play(), g.ie && (g.i.ieGame1 = !0)))
      : 1 == a &&
        (u.themeGame2.volume(1),
        u.themeGame2.playing() || ((g.ie && g.i.muteMusic) || u.themeGame2.play(), g.ie && (g.i.ieGame2 = !0)));
  };
  w.stopTheme = function () {
    var a = u.themeGame1.playing() ? u.themeGame1 : u.themeGame2.playing() ? u.themeGame2 : null;
    if (null != a) {
      var b = E.__instanceof(g.i.currentScreen, w) && E.__instanceof(g.i.targetScreen, bb);
      if (g.ie) b || a.stop();
      else {
        var c = a.volume();
        a.fade(c, 0, Math.floor(n.screenFadeTime / 2) + (b ? 1e4 : 0));
        a.once("fade", function () {
          w.canceled || (a.stop(), a.volume(1));
        });
      }
      w.stopped = !0;
      w.canceled = !1;
    } else w.stopped = w.canceled = !1;
    g.ie && (g.i.ieGame1 = g.i.ieGame2 = !1);
  };
  w.__super__ = qa;
  w.prototype = D(qa.prototype, {
    init: function () {
      w.i = this;
      this.tempLevel == A.editorLevel && v.awardEditor.unlock();
      w.playTheme(this.tempLevel.theme);
      w.continueTheme = !1;
      l.set_level(this.tempLevel);
      l.onPlay();
      for (var a = this.channels.iterator(); a.hasNext(); ) a.next().lastChanged = -1e4;
      a = 0;
      for (var b = l.get_height(); a < b; )
        for (var c = a++, d = 0, e = l.get_width(); d < e; ) {
          var f = d++;
          f = l.getBlockData(f, c);
          f.get_block() == F.door && 0 < f.getMeta(1) && this.doors.push(new Va(f));
        }
      l.level.start();
      qa.prototype.init.call(this);
      this.player = new J();
      this.player.set_x((this.player.x2 = this.player.lastX = (l.level.startCol + 0.5) * n.tileSize));
      this.player.set_y((this.player.y2 = this.player.lastY = (l.level.startRow + 1) * n.tileSize));
      this.player.set_scaleX(0 > l.level.startDir ? -1 : 1);
      this.level.addChild(this.player);
      a = this.findCameraGoal();
      this.camera.set_x(Math.round((this.cameraX = a.x)));
      this.camera.set_y(Math.round((this.cameraY = a.y + 2 * n.tileSize)));
      this.level.addChild(this.blood);
      this.level.addChild(this.overlay);
      this.vignette.set_alpha(0.75);
      this.addChild(this.vignette);
      this.addChild(this.textHolder);
      this.red.graphics.beginFill(14622752);
      this.red.graphics.drawRect(0, 0, h.width, h.height);
      this.red.visible = !1;
      this.addChild(this.red);
      if (this.speedrun) {
        if (-1 == this.speedrunStart || 0 == B.list.indexOf(l.level)) this.speedrunStart = g.i.get_gameTimeMS();
        this.timerText = new r(g.fontMain, "", 2);
        this.timerText.align = r.ALIGN_RIGHT;
        this.timerText.xAlign = r.X_ALIGN_RIGHT;
        this.timerText.set_x(h.width - 12);
        this.timerText.set_y(8);
        g.i.timerHolder.addChild(this.timerText);
        this.updateTimer();
      } else
        l.level != B.level1 ||
          g.i.hasPaused ||
          ((this.pauseText = new r(g.fontMain, "Press [ESC] or [P] to pause")),
          (this.pauseText.xAlign = r.X_ALIGN_CENTER),
          this.pauseText.set_x(Math.round(h.width / 2)),
          this.pauseText.set_y(8),
          this.pauseText.set_alpha(0.33),
          this.addChild(this.pauseText));
      a = new I(q.linkAG3);
      a.set_x(8);
      a.set_y(h.height - a.get_height() - 6);
      a.mouseEnabled = a.buttonMode = !0;
      a.addEventListener("click", function (m) {
        2 > m.which && window.open("https://armor.ag/MoreGames", "_blank").focus();
      });
      a.set_alpha(0.75);
      this.addChild(a);
    },
    updateTimer: function () {
      this.speedrun && this.timerText.set_text(g.formatMS(g.i.get_gameTimeMS() - this.speedrunStart));
    },
    killPlayer: function (a) {
      null == a && (a = !1);
      if (!this.player.dead) {
        this.player.dead = !0;
        this.deathTime = g.i.get_gameTime();
        this.player.visible = !1;
        (g.ie && g.i.muteSFX) || u.death.play();
        var b = 0,
          c = 0;
        0 == l.rotation
          ? (c = 1)
          : 1 == l.rotation
            ? (b = 1)
            : 2 == l.rotation
              ? (c = -1)
              : 3 == l.rotation && (b = -1);
        var d = this.player.dx,
          e = this.player.dy;
        1 == l.rotation
          ? ((d = this.player.dy), (e = -this.player.dx))
          : 2 == l.rotation
            ? ((d = -this.player.dx), (e = -this.player.dy))
            : 3 == l.rotation && ((d = -this.player.dy), (e = this.player.dx));
        4 < d ? (d = 4) : -4 > d && (d = -4);
        4 < e ? (e = 4) : -4 > e && (e = -4);
        var f = this.player.getHitBounds().get_center();
        a = new Ib(f.x, f.y, 14622752, 0.4 * d, 0.4 * e, b, c, !0, a ? 2 : 1);
        this.blood.addChild(a);
        null != l.level.speech && l.level.speech.killed();
        this.red.visible = !0;
      }
    },
    restart: function (a) {
      a = g.i.paused ? ((Ja = g.i), T(Ja, Ja.unpause)) : null;
      g.i.changeScreen(new w(l.level, this.speedrun, this.speedrunStart), !0, a);
    },
    finished: function () {
      var a = B.list.indexOf(l.level);
      if (-1 < a) {
        var b = !1;
        ++a;
        if (this.speedrun && a == B.list.length) {
          if (
            ((this.speedrunFinal = g.i.get_gameTimeMS() - this.speedrunStart + n.screenFadeTime / 2),
            0 > B.speedrunBest || this.speedrunFinal < B.speedrunBest)
          )
            ((B.speedrunBest = this.speedrunFinal), (b = this.newBest = !0));
        } else a > B.unlocked && a < B.list.length && ((B.unlocked = a), (b = !0));
        b && g.i.saveProgress();
      }
      a = l.level.finished();
      null != a && w.play(a, this.speedrun, this.speedrunStart);
    },
    update: function () {
      qa.prototype.update.call(this);
      if (this.player.dead) {
        var a = 1 - Math.min((g.i.get_gameTime() - this.deathTime) / w.DEATH_SHAKE_TIME, 1);
        this.red.set_alpha(a);
        a = g.smootherStep(a);
        this.shakeX = Math.random() * w.DEATH_SHAKE_AMOUNT * a;
        this.shakeY = Math.random() * w.DEATH_SHAKE_AMOUNT * a;
        g.i.get_gameTime() - this.deathTime >= w.DEATH_TIME && null == g.i.targetScreen && this.restart(!0);
      } else this.player.finished || this.doRotation(this.player);
      this.player.update();
    },
    tick: function () {
      this.player.tick();
      l.level.tick();
      null != this.cat && this.cat.tick();
      var a = this.findCameraGoal();
      this.cameraX += (a.x - this.cameraX) * n.cameraSpeed;
      this.cameraY += (a.y - this.cameraY) * n.cameraSpeed;
    },
    postUpdate: function () {
      this.player.postUpdate();
      l.level.update();
      this.camera.set_x(Math.round(this.cameraX + this.shakeX));
      this.camera.set_y(Math.round(this.cameraY + this.shakeY));
      this.updateTimer();
    },
    findCameraGoal: function () {
      var a = this.player.localToGlobal(0, 0);
      a = this.camera.globalToLocal(a.x, a.y - (l.rotating ? 0 : n.rotateOffset));
      a.x *= -1;
      a.y *= -1;
      return a;
    },
    signalOn: function (a, b, c) {
      var d = this.channels.h[c];
      null == d && ((d = new hc(c)), (this.channels.h[c] = d));
      d.signalOn(a, b);
    },
    signalOff: function (a, b, c) {
      c = this.channels.h[c];
      null != c && c.signalOff(a, b);
    },
    getChannelStatus: function (a) {
      a = this.channels.h[a];
      return null != a ? a.get_status() : !1;
    },
    catAppear: function (a, b, c) {
      this.cat = new S();
      this.cat.set_x((this.cat.x2 = (a + 0.5) * n.tileSize));
      this.cat.set_y((b + 1) * n.tileSize);
      this.cat.set_scaleX(c);
      this.cat.set_animation(S.ANIM_IDLE);
      this.level.addChild(this.cat);
    },
    catDisappear: function (a) {
      null == a && (a = 0);
      var b = this;
      null != this.cat &&
        (0 != a && this.cat.set_scaleX(a),
        (g.ie && g.i.muteSFX) || u.cat.play(),
        (this.cat.onFinish = function () {
          b.level.removeChild(b.cat);
          b.cat = null;
        }),
        this.cat.set_animation(S.ANIM_EXIT),
        (this.cat.horizontal = this.cat.scaleX));
    },
    kill: function () {
      w.i = null;
      l.level.kill();
      l.set_level(null);
      u.cat.volume(1);
      u.exit.volume(1);
      if (this.speedrun)
        if (-1 < this.speedrunFinal) {
          if ((this.timerText.set_text(g.formatMS(this.speedrunFinal)), this.newBest)) {
            var a = this.timerText;
            a.set_text(a.text + "\nNew best time!");
          }
        } else g.i.timerHolder.removeChild(this.timerText);
    },
    prekill: function () {
      w.continueTheme ? (w.stopped = w.canceled = !1) : w.stopTheme();
    },
    __class__: w
  });
  var $b = function () {
    P.call(this);
    this.graphics.beginFill();
    this.graphics.drawRect(0, 0, h.width, h.height);
    this.video = window.document.getElementById("intro");
    this.video.play();
    this.video.pause();
  };
  $b.__name__ = !0;
  $b.__super__ = P;
  $b.prototype = D(P.prototype, {
    ready: function () {
      var a = this;
      this.video.style.display = "block";
      this.video.style.cursor = "pointer";
      this.video.addEventListener("click", function (b) {
        1 < b.which || window.open("https://armor.ag/MoreGames", "_blank").focus();
      });
      this.video.addEventListener("contextmenu", function (b) {
        b.preventDefault();
        return !1;
      });
      this.video.addEventListener("ended", function (b) {
        a.video.parentElement.removeChild(a.video);
        g.element.style.display = "block";
        window.focus();
        g.i.changeScreen(new ca());
      });
      g.element.style.display = "none";
      this.video.play();
    },
    __class__: $b
  });
  var vb = function () {
    this.start = new I(q.start);
    this.pivot = new x();
    P.call(this);
  };
  vb.__name__ = !0;
  vb.__super__ = P;
  vb.prototype = D(P.prototype, {
    init: function () {
      this.timer = O.get_currentMS();
      this.pivot.set_x(h.width / 2);
      this.pivot.set_y(h.height / 2);
      this.addChild(this.pivot);
      this.start.set_x(-this.start.get_width() / 2);
      this.start.set_y(-this.start.get_height() / 2);
      this.start.set_alpha(0);
      this.pivot.addChild(this.start);
    },
    update: function () {
      var a = this,
        b = g.smootherStep(Math.min(1, (O.get_currentMS() - this.timer) / 250));
      this.pivot.set_rotation(-90 + 90 * b);
      this.pivot.set_scaleX(this.pivot.set_scaleY(2 + -b));
      this.start.set_alpha(b);
      1 != this.start.alpha ||
        this.start.buttonMode ||
        ((this.start.buttonMode = this.start.mouseEnabled = !0),
        this.start.addEventListener("click", function (c) {
          2 > c.which &&
            (u.exit.volume(1e-4),
            u.exit.play(),
            u.exit.once("end", function () {
              u.exit.volume(1);
            }),
            g.i.changeScreen(new $b()),
            (a.start.mouseEnabled = !1));
        }));
    },
    __class__: vb
  });
  var Qa = function (a) {
    null == a && (a = !1);
    this.done2 = !1;
    this.cond2 = new M(0.5);
    this.done1 = !1;
    this.cond1 = new M(10);
    P.call(this);
    this.pausable = !0;
    this.speedrun = a;
  };
  Qa.__name__ = !0;
  Qa.__super__ = P;
  Qa.prototype = D(P.prototype, {
    init: function () {
      this.cond1.start();
      this.speech = new U(
        [new C(new M(2), "It's time to resume your training."), new C(new M(4), "We'll start with the basics.")],
        this
      );
      this.cond2.start();
    },
    update: function () {
      !this.done2 && this.cond2.test() && ((this.done2 = !0), w.playTheme(0), g.ie || u.themeGame1.fade(0, 1, 1e3));
      this.speech.update();
      !this.done1 && this.cond1.test() && ((this.done1 = !0), w.play(B.level1, this.speedrun));
    },
    prekill: function () {
      w.continueTheme || w.stopTheme();
    },
    kill: function () {},
    __class__: Qa
  });
  var r = function (a, b, c) {
    null == c && (c = 0);
    null == b && (b = "");
    this.textWidth = this.textHeight = 0;
    this.lineWidths = [];
    this.align = this.xAlign = this.yAlign = this.lineHeight = this.hitPadding = 0;
    this.text = "";
    var d = this;
    x.call(this);
    this.set_font(a);
    this.set_text(b);
    this.color = c;
    this.addEventListener("render", function (e) {
      d.render(e.surface);
    });
  };
  r.__name__ = !0;
  r.drawText = function (a, b, c, d, e, f) {
    null == f && (f = 0);
    null == c && (c = "");
    for (var m = 0, k = 0, p = 0, y = 0, H = c.length; y < H; ) {
      var K = y++;
      "\n" == c.charAt(K)
        ? (++p, (m = 0), (k += b.lineHeight))
        : ((K = ja.cca(c, K)),
          (K = b.chars[K]),
          null != K &&
            (a.drawImage(b.image, new z(K.x + f * b.colorOffset, K.y, K.w, K.h), d + m + K.xo, e + k + K.yo),
            (m += K.xa)));
    }
  };
  r.__super__ = x;
  r.prototype = D(x.prototype, {
    set_font: function (a) {
      this.font = a;
      this.set_lineHeight(a.lineHeight);
      this.precalc();
      return a;
    },
    set_text: function (a) {
      this.text = a;
      this.precalc();
      return a;
    },
    set_lineHeight: function (a) {
      this.lineHeight = a;
      this.precalc();
      return a;
    },
    precalc: function () {
      var a = 0,
        b = 0,
        c = this.lineHeight,
        d = 0;
      this.lineWidths = [];
      for (var e = 0, f = this.text.length; e < f; ) {
        var m = e++;
        if ("\n" == this.text.charAt(m))
          (this.lineWidths.push(d), d > b && (b = d), (a = d = 0), (c += this.lineHeight));
        else if (((m = ja.cca(this.text, m)), (m = this.font.chars[m]), null != m)) {
          var k = m.xo + m.w;
          d += a + k;
          a = m.xa - k;
        }
      }
      this.lineWidths.push(d);
      d > b && (b = d);
      this.textWidth = b;
      this.textHeight = c;
    },
    render: function (a) {
      for (
        var b = this.getTextOffset(),
          c = -this.getLineOffset(this.lineWidths[0]),
          d = 0,
          e = 0,
          f = 0,
          m = this.text.length;
        f < m;
      ) {
        var k = f++;
        "\n" == this.text.charAt(k)
          ? (++e, (c = -this.getLineOffset(this.lineWidths[e])), (d += this.lineHeight))
          : ((k = ja.cca(this.text, k)),
            (k = this.font.chars[k]),
            null != k &&
              (a.drawImage(
                this.font.image,
                new z(k.x + this.color * this.font.colorOffset, k.y, k.w, k.h),
                b.x + c + k.xo,
                b.y + d + k.yo
              ),
              (c += k.xa)));
      }
    },
    getBoundsSelf: function () {
      var a = this.getTextOffset();
      return new z(
        a.x - this.hitPadding,
        a.y - this.hitPadding,
        this.textWidth + 2 * this.hitPadding,
        this.textHeight + 2 * this.hitPadding
      );
    },
    getTextOffset: function () {
      var a = new Q(0, 0);
      this.xAlign == r.X_ALIGN_CENTER && (a.x = Math.round(-this.textWidth / 2));
      this.xAlign == r.X_ALIGN_RIGHT && (a.x = -this.textWidth);
      this.yAlign == r.Y_ALIGN_MIDDLE && (a.y = Math.round(-this.textHeight / 2));
      this.yAlign == r.Y_ALIGN_BOTTOM && (a.y = -this.textHeight);
      return a;
    },
    getLineOffset: function (a) {
      return this.align == r.ALIGN_CENTER
        ? Math.round((-this.textWidth + a) / 2)
        : this.align == r.ALIGN_RIGHT
          ? -this.textWidth + a
          : 0;
    },
    __class__: r
  });
  var Xb = function (a) {
    x.call(this);
    var b = new I(q.awardFrame);
    b.set_x(-b.get_width() / 2);
    this.addChild(b);
    b = new I(a.unlocked ? a.icon : q.awardIconLocked);
    b.set_x(-b.get_width() / 2);
    b.set_y(8);
    this.addChild(b);
    b = new r(g.fontMain, a.name, 1);
    b.align = r.ALIGN_CENTER;
    b.xAlign = r.X_ALIGN_CENTER;
    b.set_y(64);
    b.set_lineHeight(b.lineHeight - 4);
    this.addChild(b);
    a.unlocked || this.set_alpha(0.5);
  };
  Xb.__name__ = !0;
  Xb.__super__ = x;
  Xb.prototype = D(x.prototype, { __class__: Xb });
  var N = function () {
    this.bubble = new ac();
    var a = this;
    x.call(this);
    this.mouseEnabled = this.buttonMode = !0;
    this.bubble.visible = !1;
    this.bubble.mouseEnabled = !0;
    this.addChild(this.bubble);
    this.addEventListener("mouseDown", function (b) {
      if (b.target == a && 2 > b.which) {
        var c = N.selected;
        N.set_selected(Math.floor(a.globalToLocal(b.x, b.y).x / N.size4));
        a.bubble.set_x(Math.round((N.selected + 0.5) * N.size4));
        b = a.get_selection().configurable && (N.selected == c ? !a.bubble.visible : !0);
        a.bubble.visible = b;
        a.bubble.visible && a.bubble.setup(a.get_selection());
      }
    });
    this.addEventListener("render", function (b) {
      a.render(b.surface);
    });
  };
  N.__name__ = !0;
  N.set_selected = function (a) {
    return (N.selected = 0 > a ? 0 : a >= N.list.length ? N.list.length - 1 : a);
  };
  N.__super__ = x;
  N.prototype = D(x.prototype, {
    get_selection: function () {
      return N.list[N.selected];
    },
    render: function (a) {
      a.beginFill(12525600, 0.75);
      a.drawRect((G.keyDown(16) ? 0 : N.selected) * N.size4, 0, N.size4, N.size4);
      a.translate(2, 2);
      a.beginFill(14671839);
      for (var b = 0, c = N.list.length; b < c; ) {
        var d = b++,
          e = N.list[d];
        0 < d && a.translate(N.size4, 0);
        e.rotatePreview() &&
          (a.translate(N.size2, N.size2), a.rotate((l.rotation * Math.PI) / 2), a.translate(-N.size2, -N.size2));
        a.drawRect(0, 0, n.tileSize, n.tileSize);
        e.render(a, new wb(0, 0, e.id, e.getConfigMeta()), !1);
        e.rotatePreview() &&
          (a.translate(N.size2, N.size2), a.rotate((-l.rotation * Math.PI) / 2), a.translate(-N.size2, -N.size2));
      }
      a.translate((N.list.length - 1) * -N.size4, 0);
      a.translate(-2, -2);
    },
    getBoundsSelf: function () {
      return new z(0, 0, N.list.length * (n.tileSize + 4), n.tileSize + 4);
    },
    __class__: N
  });
  var ac = function () {
    this.tip = new I(q.configTip);
    x.call(this);
    this.tip.set_x(-this.tip.get_width() / 2);
    this.tip.set_y(-this.tip.get_height());
    this.addChild(this.tip);
  };
  ac.__name__ = !0;
  ac.__super__ = x;
  ac.prototype = D(x.prototype, {
    setup: function (a) {
      var b = Math.round(a.bubbleWidth / 2);
      this.graphics.clear();
      this.graphics.beginFill(8421504);
      this.graphics.drawRect(
        -b - 2,
        -a.bubbleHeight - this.tip.get_height() - 2,
        a.bubbleWidth + 4,
        a.bubbleHeight + 4
      );
      this.graphics.beginFill(2105376);
      this.graphics.drawRect(-b, -a.bubbleHeight - this.tip.get_height(), a.bubbleWidth, a.bubbleHeight);
      null != this.content && this.removeChild(this.content);
      this.content = new x();
      this.content.set_x(-b);
      this.content.set_y(-a.bubbleHeight - this.tip.get_height());
      this.addChild(this.content);
      a.setupBubble(this.content);
    },
    __class__: ac
  });
  var Da = function (a, b) {
    null == b && (b = "");
    x.call(this);
    this.graphics.beginFill(1052688, 0.95);
    this.graphics.drawRect(0, 0, h.width, h.height);
    this.mouseEnabled = !0;
    this.title = new r(g.fontMain, a);
    this.title.xAlign = r.X_ALIGN_CENTER;
    this.title.set_x(Math.round(h.width / 2));
    this.title.set_y(36);
    this.addChild(this.title);
    this.area = window.document.createElement("textarea");
    var c = h.width - 80;
    window.document.body.appendChild(this.area);
    this.area.style.position = "absolute";
    this.area.style.left = Math.round((h.width - c) / 2) + "px";
    this.area.style.top = Math.round((h.height - 300) / 2 - 8) + "px";
    this.area.style.width = c - 12 + "px";
    this.area.style.height = "288px";
    this.area.style.resize = "none";
    this.area.style.border = this.area.style.outline = "none";
    this.area.style.margin = "0";
    this.area.style.padding = "6px";
    this.area.style.background = "#fff";
    this.area.style.color = "#000";
    this.area.style.fontFamily = "'Courier New', Courier, monospace";
    this.area.style.fontSize = "12px";
    this.area.value = b;
    this.area.select();
  };
  Da.__name__ = !0;
  Da.__super__ = x;
  Da.prototype = D(x.prototype, {
    kill: function () {
      null != this.area.parentElement && window.document.body.removeChild(this.area);
    },
    __class__: Da
  });
  var Yb = function () {
    this.btnLoad = new ba("LOAD");
    this.btnCancel = new ba("CANCEL");
    this.invalid = new r(g.fontMain, "Level code is invalid!", 2);
    var a = this;
    Da.call(this, "LOAD LEVEL");
    this.invalid.xAlign = r.X_ALIGN_CENTER;
    this.invalid.yAlign = r.Y_ALIGN_BOTTOM;
    this.invalid.set_x(Math.round(h.width / 2));
    this.invalid.set_y(h.height - 82);
    this.invalid.visible = !1;
    this.addChild(this.invalid);
    this.btnCancel.set_x(Math.round(h.width / 2) - 96);
    this.btnCancel.set_y(h.height - 52);
    this.btnCancel.addEventListener("click", function (b) {
      if (2 > b.which && null != a.onBack) a.onBack();
    });
    this.addChild(this.btnCancel);
    this.btnLoad.set_x(Math.round(h.width / 2) + 96);
    this.btnLoad.set_y(h.height - 52);
    this.btnLoad.addEventListener("click", function (b) {
      2 > b.which && null != a.onLoad && !a.onLoad(a.area.value) && (a.invalid.visible = !0);
    });
    this.addChild(this.btnLoad);
    this.area.addEventListener("input", function () {
      a.invalid.visible = !1;
    });
  };
  Yb.__name__ = !0;
  Yb.__super__ = Da;
  Yb.prototype = D(Da.prototype, { __class__: Yb });
  var Zb = function (a) {
    this.btnBack = new ba("BACK");
    var b = this;
    Da.call(this, "SAVE LEVEL", a);
    this.area.readOnly = !0;
    this.btnBack.set_x(Math.round(h.width / 2));
    this.btnBack.set_y(h.height - 52);
    this.btnBack.addEventListener("click", function (c) {
      if (2 > c.which && null != b.onBack) b.onBack();
    });
    this.addChild(this.btnBack);
  };
  Zb.__name__ = !0;
  Zb.__super__ = Da;
  Zb.prototype = D(Da.prototype, { __class__: Zb });
  var Pa = function (a) {
    this.selector = new N();
    var b = this;
    x.call(this);
    this.set_y(h.height - Pa.HEIGHT);
    this.mouseEnabled = !0;
    this.graphics.beginFill(2105376);
    this.graphics.drawRect(0, 0, h.width, Pa.HEIGHT);
    this.gridToggle = new bc(a);
    this.addChild(this.gridToggle);
    this.selector.set_x(12);
    this.selector.set_y(Math.round((Pa.HEIGHT - this.selector.get_height()) / 2));
    this.addChild(this.selector);
    this.addEventListener("mouseDown", function (c) {
      2 > c.which && c.target == b && (b.selector.bubble.visible = !1);
    });
  };
  Pa.__name__ = !0;
  Pa.__super__ = x;
  Pa.prototype = D(x.prototype, { __class__: Pa });
  var R = function (a, b) {
    this.btnLoad = new r(g.fontMain, "Load");
    this.btnSave = new r(g.fontMain, "Save");
    this.btnPlay = new r(g.fontMain, "Play");
    this.btnClear = new r(g.fontMain, "Clear");
    this.btnExit = new r(g.fontMain, "Exit");
    x.call(this);
    this.mouseEnabled = !0;
    this.graphics.beginFill(2105376);
    this.graphics.drawRect(0, 0, h.width, R.HEIGHT);
    this.btnExit.set_x(R.EDGE_PAD);
    this.btnExit.set_y(R.EDGE_PAD_Y);
    this.btnExit.mouseEnabled = this.btnExit.buttonMode = !0;
    this.btnExit.hitPadding = R.BTN_PAD;
    this.btnExit.addEventListener("click", function (d) {
      2 > d.which && g.i.changeScreen(new Oa());
    });
    this.addChild(this.btnExit);
    this.btnClear.set_x(this.btnExit.x + this.btnExit.get_width() + R.BTN_SPACE);
    this.btnClear.set_y(R.EDGE_PAD_Y);
    this.btnClear.mouseEnabled = this.btnClear.buttonMode = !0;
    this.btnClear.hitPadding = R.BTN_PAD;
    this.btnClear.set_alpha(R.TEXT_GREY);
    this.addChild(this.btnClear);
    this.theme = new r(g.fontMain, R.THEMES[a]);
    this.theme.set_x(this.btnClear.x + this.btnClear.get_width() + 72);
    this.theme.set_y(R.EDGE_PAD_Y);
    this.theme.xAlign = r.X_ALIGN_CENTER;
    this.addChild(this.theme);
    var c = new I(q.configArrow);
    c.mouseEnabled = c.buttonMode = !0;
    c.set_x(this.theme.x + 46);
    c.set_y(this.theme.y + 4);
    c.addEventListener("mouseDown", function (d) {
      2 > d.which && b(-1);
    });
    this.addChild(c);
    c = new I(q.configArrow);
    c.mouseEnabled = c.buttonMode = !0;
    c.set_scaleX(-1);
    c.set_x(this.theme.x - 46);
    c.set_y(this.theme.y + 4);
    c.addEventListener("mouseDown", function (d) {
      2 > d.which && b(1);
    });
    this.addChild(c);
    this.btnPlay.set_x(h.width - R.EDGE_PAD);
    this.btnPlay.set_y(R.EDGE_PAD_Y);
    this.btnPlay.xAlign = r.X_ALIGN_RIGHT;
    this.btnPlay.mouseEnabled = this.btnPlay.buttonMode = !0;
    this.btnPlay.hitPadding = R.BTN_PAD;
    this.btnPlay.addEventListener("click", function (d) {
      2 > d.which && w.play(A.editorLevel);
    });
    this.addChild(this.btnPlay);
    this.btnSave.set_x(this.btnPlay.x - this.btnPlay.get_width() - R.BTN_SPACE);
    this.btnSave.set_y(R.EDGE_PAD_Y);
    this.btnSave.xAlign = r.X_ALIGN_RIGHT;
    this.btnSave.mouseEnabled = this.btnSave.buttonMode = !0;
    this.btnSave.hitPadding = R.BTN_PAD;
    this.btnSave.set_alpha(R.TEXT_GREY);
    this.addChild(this.btnSave);
    this.btnLoad.set_x(this.btnSave.x - this.btnSave.get_width() - R.BTN_SPACE);
    this.btnLoad.set_y(R.EDGE_PAD_Y);
    this.btnLoad.xAlign = r.X_ALIGN_RIGHT;
    this.btnLoad.mouseEnabled = this.btnLoad.buttonMode = !0;
    this.btnLoad.hitPadding = R.BTN_PAD;
    this.btnLoad.set_alpha(R.TEXT_GREY);
    this.addChild(this.btnLoad);
  };
  R.__name__ = !0;
  R.__super__ = x;
  R.prototype = D(x.prototype, { __class__: R });
  var Ya = function () {
    I.call(this, q.trash);
    this.set_x(h.width - 120);
    this.set_y(h.height - this.get_height() - 12);
    for (var a = !1, b = 0, c = v.all; b < c.length; ) {
      var d = c[b];
      ++b;
      if (d.unlocked) {
        a = !0;
        break;
      }
    }
    0 != B.unlocked || a
      ? ((this.buttonMode = this.mouseEnabled = !0),
        this.addEventListener("click", function (e) {
          if (2 > e.which) {
            var f = new eb("Do you want to erase ALL of\nyour saved progress?");
            f.onNo = function () {
              g.i.currentScreen.removeChild(f);
            };
            f.onYes = function () {
              g.i.clearProgress();
              g.i.changeScreen(new ca());
            };
            g.i.currentScreen.addChild(f);
          }
        }))
      : this.set_alpha(0.33);
  };
  Ya.__name__ = !0;
  Ya.__super__ = I;
  Ya.prototype = D(I.prototype, { __class__: Ya });
  var bc = function (a) {
    this.label = new r(g.fontMain, "Grid");
    this.toggle = new I(q.configToggle);
    var b = this;
    x.call(this);
    this.set_x(h.width - this.get_width() - 12);
    this.set_y(8);
    this.mouseEnabled = this.buttonMode = !0;
    this.addEventListener("click", function (c) {
      1 < c.which ||
        ((A.showGrid = !A.showGrid),
        (b.toggle.clipRect.x = A.showGrid ? b.toggle.clipRect.width : 0),
        null != a && a());
    });
    this.toggle.clipRect.width /= 2;
    this.toggle.clipRect.x = A.showGrid ? this.toggle.clipRect.width : 0;
    this.toggle.set_x(4);
    this.toggle.set_y(5);
    this.addChild(this.toggle);
    this.label.set_x(32);
    this.label.set_y(1);
    this.label.set_alpha(R.TEXT_GREY);
    this.addChild(this.label);
  };
  bc.__name__ = !0;
  bc.__super__ = x;
  bc.prototype = D(x.prototype, {
    getBoundsSelf: function () {
      return new z(0, 0, 76, 30);
    },
    __class__: bc
  });
  var Na = function () {
    var a = this;
    x.call(this);
    this.addEventListener("render", function (b) {
      a.render(b.surface);
    });
  };
  Na.__name__ = !0;
  Na.__super__ = x;
  Na.prototype = D(x.prototype, {
    render: function (a) {
      for (
        var b = -Math.round((30 * O.get_current()) % q.bgCells.width),
          c = -Math.round((15 * O.get_current()) % q.bgCells.height),
          d = 0,
          e = Math.ceil(h.height / q.bgCells.height) + 1;
        d < e;
      )
        for (var f = d++, m = 0, k = Math.ceil(h.width / q.bgCells.width) + 1; m < k; ) {
          var p = m++;
          a.drawImage(q.bgCells, null, b + q.bgCells.width * p, c + q.bgCells.height * f);
        }
      a.drawImage(q.vignette, null, 0, 0);
    },
    __class__: Na
  });
  var ba = function (a, b) {
    null == b && (b = 0);
    x.call(this);
    this.main = new I(q.menuBtn);
    this.main.set_x(-this.main.get_width() / 2);
    this.main.set_y(-this.main.get_height() / 2);
    this.main.mouseEnabled = this.main.buttonMode = !0;
    this.addChild(this.main);
    var c = (this.text = new r(g.fontMain, a.toUpperCase(), b));
    c.set_y(c.y - 2);
    this.text.align = r.ALIGN_CENTER;
    this.text.xAlign = r.X_ALIGN_CENTER;
    this.text.yAlign = r.Y_ALIGN_MIDDLE;
    this.addChild(this.text);
  };
  ba.__name__ = !0;
  ba.__super__ = x;
  ba.prototype = D(x.prototype, { __class__: ba });
  var Ba = function (a) {
    null == a && (a = 0);
    var b = this;
    x.call(this);
    this.sfx = new I(q.mute);
    this.sfx.set_clipRect(new z(g.i.muteSFX ? 28 : 0, 30 * a, 28, 30));
    this.sfx.mouseEnabled = this.sfx.buttonMode = !0;
    this.sfx.addEventListener("click", function (c) {
      2 > c.which && (g.ie && !g.i.ieUnmuted ? b.showWarn(T(b, b.toggleSFX)) : b.toggleSFX());
    });
    this.sfx.set_x(h.width - this.sfx.get_width() - 12);
    this.sfx.set_y(h.height - this.sfx.get_height() - 12);
    this.addChild(this.sfx);
    this.music = new I(q.mute);
    this.music.set_clipRect(new z(g.i.muteMusic ? 84 : 56, 30 * a, 28, 30));
    this.music.mouseEnabled = this.music.buttonMode = !0;
    this.music.addEventListener("click", function (c) {
      2 > c.which && (g.ie && !g.i.ieUnmuted ? b.showWarn(T(b, b.toggleMusic)) : b.toggleMusic());
    });
    this.music.set_x(this.sfx.x - this.music.get_width() - 12);
    this.music.set_y(h.height - this.music.get_height() - 12);
    this.addChild(this.music);
  };
  Ba.__name__ = !0;
  Ba.__super__ = x;
  Ba.prototype = D(x.prototype, {
    showWarn: function (a) {
      var b = new eb("Audio may slow down the game\nin Internet Explorer. Continue?");
      b.onNo = function () {
        g.i.removeChild(b);
      };
      b.onYes = function () {
        g.i.removeChild(b);
        g.i.ieUnmuted = !0;
        null != a && a();
      };
      g.i.addChild(b);
    },
    toggleSFX: function () {
      g.i.toggleSFX();
      this.sfx.clipRect.x = g.i.muteSFX ? 28 : 0;
    },
    toggleMusic: function () {
      g.i.toggleMusic();
      this.music.clipRect.x = g.i.muteMusic ? 84 : 56;
    },
    __class__: Ba
  });
  var cc = function () {
    x.call(this);
    this.set_x(12);
    this.set_y(12);
    this.mouseEnabled = this.buttonMode = !0;
    var a = new r(g.fontMain, "Invert [Q] & [E]?");
    a.set_x(30);
    a.set_y(-4);
    a.set_alpha(0.5);
    this.addChild(a);
    var b = new I(q.configToggle);
    b.clipRect.width = 22;
    g.i.invert && (b.clipRect.x = 22);
    b.set_alpha(0.75);
    this.addChild(b);
    this.addEventListener("click", function (c) {
      2 > c.which && ((g.i.invert = !g.i.invert), (b.clipRect.x = g.i.invert ? 22 : 0), g.i.saveProgress());
    });
  };
  cc.__name__ = !0;
  cc.__super__ = x;
  cc.prototype = D(x.prototype, {
    getBoundsSelf: function () {
      return new z(0, 0, 198, 22);
    },
    __class__: cc
  });
  var ub = function () {
    this.sponsor = new Ma();
    this.mute = new Ba(1);
    this.invert = new cc();
    this.btnQuit = new ba("QUIT", 0);
    this.btnRedo = new ba("RESTART", 0);
    this.btnPlay = new ba("CONTINUE", 0);
    this.text = new r(g.fontMain, "GAME PAUSED");
    x.call(this);
    this.graphics.beginFill(1052688, 0.85);
    this.graphics.drawRect(0, 0, h.width, h.height);
    this.visible = !1;
    this.mouseEnabled = !0;
    this.text.align = r.ALIGN_CENTER;
    this.text.xAlign = r.X_ALIGN_CENTER;
    this.text.yAlign = r.Y_ALIGN_MIDDLE;
    this.text.set_x(Math.floor(h.width / 2));
    this.text.set_y(Math.floor(h.height / 2) - 96 - 1);
    this.addChild(this.text);
    this.btnPlay.set_x(this.text.x);
    this.btnPlay.set_y(this.text.y + 60);
    this.btnPlay.addEventListener("click", function (a) {
      2 > a.which && g.i.unpause();
    });
    this.addChild(this.btnPlay);
    this.btnRedo.set_x(this.btnPlay.x);
    this.btnRedo.set_y(this.btnPlay.y + 60);
    this.btnRedo.addEventListener("click", function (a) {
      2 > a.which && E.__instanceof(g.i.currentScreen, w) && g.i.currentScreen.restart(!1);
    });
    this.addChild(this.btnRedo);
    this.btnQuit.set_x(this.btnRedo.x);
    this.btnQuit.set_y(this.btnRedo.y + 60);
    this.btnQuit.addEventListener("click", function (a) {
      2 > a.which &&
        ((a =
          (E.__instanceof(g.i.currentScreen, w) && E.__cast(g.i.currentScreen, w).speedrun) ||
          (E.__instanceof(g.i.currentScreen, Qa) && E.__cast(g.i.currentScreen, Qa).speedrun)),
        g.i.changeScreen(
          l.level == A.editorLevel ? new A() : a ? new Oa() : 0 < B.unlocked ? new pb() : new ca(),
          !0,
          ((Ja = g.i), T(Ja, Ja.unpause))
        ));
    });
    this.addChild(this.btnQuit);
    this.addChild(this.invert);
    this.addChild(this.mute);
    this.addChild(this.sponsor);
    g.i.warnNoSave(this);
  };
  ub.__name__ = !0;
  ub.__super__ = x;
  ub.prototype = D(x.prototype, {
    onPause: function () {
      this.mute.sfx.clipRect.x = g.i.muteSFX ? 28 : 0;
      this.mute.music.clipRect.x = g.i.muteMusic ? 84 : 56;
      var a = E.__instanceof(g.i.currentScreen, w);
      this.btnRedo.set_alpha(a ? 1 : 0.25);
      this.btnRedo.main.mouseEnabled = a;
      a = E.__instanceof(g.i.currentScreen, bb) || E.__instanceof(g.i.currentScreen, ob);
      this.btnQuit.set_alpha(a ? 0.25 : 1);
      this.btnQuit.main.mouseEnabled = !a;
    },
    __class__: ub
  });
  var Ma = function () {
    I.call(this, q.linkAG);
    this.set_x(8);
    this.set_y(h.height - this.get_height() - 6);
    this.mouseEnabled = this.buttonMode = !0;
    this.addEventListener("click", function (a) {
      2 <= a.which || window.open("https://armor.ag/MoreGames", "_blank").focus();
    });
  };
  Ma.__name__ = !0;
  Ma.__super__ = I;
  Ma.prototype = D(I.prototype, { __class__: Ma });
  var eb = function (a) {
    this.btnNo = new ba("NO");
    this.btnYes = new ba("YES");
    this.main = new r(g.fontMain, "", 2);
    var b = this;
    x.call(this);
    this.main.set_text(a);
    this.graphics.beginFill(1052688, 0.95);
    this.graphics.drawRect(0, 0, h.width, h.height);
    this.mouseEnabled = !0;
    this.main.align = r.ALIGN_CENTER;
    this.main.xAlign = r.X_ALIGN_CENTER;
    this.main.yAlign = r.Y_ALIGN_MIDDLE;
    this.main.set_x(Math.round(h.width / 2));
    this.main.set_y(Math.round(h.height / 2) - 40);
    this.addChild(this.main);
    this.btnYes.set_x(Math.round(h.width / 2) - 96);
    this.btnYes.set_y(Math.round(h.height / 2) + 40);
    this.btnYes.addEventListener("click", function (c) {
      if (2 > c.which && null != b.onYes) b.onYes();
    });
    this.addChild(this.btnYes);
    this.btnNo.set_x(Math.round(h.width / 2) + 96);
    this.btnNo.set_y(Math.round(h.height / 2) + 40);
    this.btnNo.addEventListener("click", function (c) {
      if (2 > c.which && null != b.onNo) b.onNo();
    });
    this.addChild(this.btnNo);
  };
  eb.__name__ = !0;
  eb.__super__ = x;
  eb.prototype = D(x.prototype, { __class__: eb });
  var Ja,
    pc = 0;
  String.prototype.__class__ = String;
  String.__name__ = !0;
  Array.__name__ = !0;
  Date.prototype.__class__ = Date;
  Date.__name__ = ["Date"];
  var rc = { __name__: ["Int"] },
    qc = { __name__: ["Dynamic"] },
    kc = Number;
  kc.__name__ = ["Float"];
  var mc = Boolean;
  mc.__ename__ = ["Bool"];
  var sc = { __name__: ["Class"] },
    tc = {},
    na = {},
    tb = jc.ArrayBuffer || xa;
  null == tb.prototype.slice && (tb.prototype.slice = xa.sliceImpl);
  var ec = jc.Uint8Array || Ia._new;
  h.started = !1;
  h.imageSmoothingEnabled = !0;
  h.lastCursor = "default";
  h.scale = 1;
  h.offsetX = 0;
  h.offsetY = 0;
  h.wasLoaded = !1;
  h.lastProgress = 0;
  t.inited = !1;
  t.finished = !1;
  t.tasks = [];
  t.events = new Sa();
  O.startTime = 0;
  O.lastTime = 0;
  O.elapsedTime = 0;
  rb.PI2 = 2 * Math.PI;
  Y.ADDED = "added";
  Y.REMOVED = "removed";
  Y.ENTER_FRAME = "enterFrame";
  Y.EXIT_FRAME = "exitFrame";
  Ta.FOCUS = "focus";
  Ta.BLUR = "blur";
  Ua.KEY_DOWN = "keyDown";
  Ua.KEY_UP = "keyUp";
  Fa.FINISHED = "finished";
  Fa.PROGRESS = "progress";
  Ha.CLICK = "click";
  Ha.MOUSE_DOWN = "mouseDown";
  Ha.MOUSE_UP = "mouseUp";
  Ha.MOVE = "move";
  fb.RENDER = "render";
  G.inited = !1;
  G.keys = [];
  G.keysOld = [];
  Ga.FUNC = 1;
  Ea.PI2 = 2 * Math.PI;
  ra.CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  ra.BYTES = za.ofString(ra.CHARS);
  E.__toStr = {}.toString;
  Ia.BYTES_PER_ELEMENT = 1;
  n.E = 1e-8;
  n.screenFadeTime = 700;
  n.screenFadeTimeSlow = 1600;
  n.tileSize = 24;
  n.tickMS = 16.666666666666668;
  n.ticksMax = 12;
  n.cameraSpeed = 0.075;
  n.rotateTime = 0.5;
  n.rotateOffset = 1.5 * n.tileSize;
  n.doorSlideTime = 0.2;
  q.start = t.loadImage("img/start.png");
  q.linkAG = t.loadImage("img/link-ag.png");
  q.linkAG2 = t.loadImage("img/link-ag-2.png");
  q.linkAG3 = t.loadImage("img/link-ag-3.png");
  q.linkLike = t.loadImage("img/link-like.png");
  q.linkJoshua2 = t.loadImage("img/link-joshua-2.png");
  q.soundtrack = t.loadImage("img/soundtrack.png");
  q.awardFrame = t.loadImage("img/award-frame.png");
  q.awardIconLocked = t.loadImage("img/award-icon-locked.png");
  q.awardIconEscape = t.loadImage("img/award-icon-escape.png");
  q.awardIconSpeedrun = t.loadImage("img/award-icon-speedrun.png");
  q.awardIconEditor = t.loadImage("img/award-icon-editor.png");
  q.awardIconJoshua = t.loadImage("img/award-icon-joshua.png");
  q.awardIconSoundtrack = t.loadImage("img/award-icon-soundtrack.png");
  q.awardIconRotate = t.loadImage("img/award-icon-rotate.png");
  q.vignette = t.loadImage("img/vignette.png");
  q.bgCells = t.loadImage("img/bg-cells.png");
  q.logo = t.loadImage("img/logo.png");
  q.configTip = t.loadImage("img/config-tip.png");
  q.configArrow = t.loadImage("img/config-arrow.png");
  q.configToggle = t.loadImage("img/config-toggle.png");
  q.menuBtn = t.loadImage("img/menu-btn.png");
  q.level = t.loadImage("img/level.png");
  q.interact = t.loadImage("img/interact.png");
  q.mute = t.loadImage("img/mute.png");
  q.trash = t.loadImage("img/trash.png");
  q.player = t.loadImage("img/player.png");
  q.bgTiles = t.loadImage("img/bg-tiles.png");
  q.bgBricks = t.loadImage("img/bg-bricks.png");
  q.blocks = t.loadImage("img/blocks.png");
  q.cat = t.loadImage("img/cat.png");
  q.endingMain = t.loadImage("img/ending-main.png");
  q.endingPlants = t.loadImage("img/ending-plants.png");
  q.controls1 = t.loadImage("img/controls-1.png");
  q.controls2 = t.loadImage("img/controls-2.png");
  q.controls3 = t.loadImage("img/controls-3.png");
  q.controls4 = t.loadImage("img/controls-4.png");
  q.controls5 = t.loadImage("img/controls-5.png");
  g.fontMain = new gc("fonts/simple-pixels.png", "fonts/simple-pixels.json", 2, 112);
  g.nosave = !1;
  g.ie = !1;
  u.themeMenu = t.loadSound({ src: ["music/menu.ogg", "music/menu.mp3"], loop: !0 });
  u.themeGame1 = t.loadSound({ src: ["music/game-1.ogg", "music/game-1.mp3"], loop: !0, volume: 0.8 });
  u.themeGame2 = t.loadSound({ src: ["music/game-2.ogg", "music/game-2.mp3"], loop: !0, volume: 0.75 });
  u.surface = t.loadSound({ src: ["sfx/surface.ogg", "sfx/surface.mp3"], loop: !0 });
  u.steps = t.loadSound({ src: ["sfx/steps.ogg", "sfx/steps.mp3"], sprite: { a: [0, 400], b: [475, 400] } });
  u.death = t.loadSound({ src: ["sfx/death.ogg", "sfx/death.mp3"] });
  u.rotate = t.loadSound({ src: ["sfx/rotate.ogg", "sfx/rotate.mp3"] });
  u.exit = t.loadSound({ src: ["sfx/exit.ogg", "sfx/exit.mp3"] });
  u.door = t.loadSound({ src: ["sfx/door.ogg", "sfx/door.mp3"] });
  u.cat = t.loadSound({ src: ["sfx/cat.ogg", "sfx/cat.mp3"] });
  u.leverOn = t.loadSound({ src: ["sfx/lever-on.ogg", "sfx/lever-on.mp3"] });
  u.leverOff = t.loadSound({ src: ["sfx/lever-off.ogg", "sfx/lever-off.mp3"] });
  u.voice = t.loadSound({
    src: ["sfx/voice.ogg", "sfx/voice.mp3"],
    sprite: {
      a: [0, 1e3],
      b: [1111, 1e3],
      c: [2222, 1e3],
      d: [3333, 1e3],
      e: [4444, 1e3],
      f: [5555, 1e3],
      g: [6666, 1e3],
      h: [7777, 1e3]
    },
    volume: 0.9
  });
  u.SFX = [u.steps, u.death, u.rotate, u.exit, u.door, u.cat, u.leverOn, u.leverOff, u.voice];
  v.awardEscape = new Ka("The Beginning", q.awardIconEscape);
  v.awardSpeedrun = new Ka("Seven or\nLess", q.awardIconSpeedrun);
  v.awardEditor = new Ka("Architect", q.awardIconEditor);
  v.awardJoshua = new Ka("Curiosity", q.awardIconJoshua);
  v.awardSoundtrack = new Ka("Sound Seeker", q.awardIconSoundtrack);
  v.awardRotate = new Ka("Rotate Me", q.awardIconRotate);
  v.all = [v.awardEscape, v.awardSpeedrun, v.awardEditor, v.awardJoshua, v.awardSoundtrack, v.awardRotate];
  v.FADE_MS = 250;
  v.STAY_MS = 3e3;
  v.bubbleTimer = -1;
  S.SPEED = 2;
  S.ACCEL = 0.06;
  S.DECCEL_MULT = 0.6;
  S.ANIM_IDLE = new ta(
    [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5],
    [1500, 100, 100, 100, 100, 100, 3e3, 100, 100, 200, 100, 100]
  );
  S.ANIM_EXIT = new ta([9, 10, 11, 12, 13, 14, 15, 16, 17], [100, 100, 100, 100, 100, 100, 100, 100, 100], !1);
  S.ANIM_END_1 = new ta([9, 10], [100, 100], !1);
  S.ANIM_END_2 = new ta([11, 12, 22, 14, 24, 25, 26], [100, 100, 100, 100, 100, 100, 100]);
  J.HIT_W = 12;
  J.HIT_H = 42;
  J.SPEED = 3.7;
  J.RAMP_MULT = 0.7;
  J.ACCEL = 0.33;
  J.DECCEL_MULT = 0.6;
  J.JUMP_SPEED = 5.9;
  J.JUMP_DELAY = 0.25;
  J.JUMP_DELAY_2 = 0.06666666666666667;
  J.GRAVITY = 0.35;
  J.GRAVITY_MAX = 9;
  J.ROTATE_DELAY = 0.05;
  J.ANIM_IDLE = new ta([0, 1, 2, 3], [400, 400, 400, 400]);
  J.ANIM_RUN = new ta([4, 5, 6, 7], [100, 100, 100, 100]);
  J.ANIM_JUMP = new ta([8, 9], [200, 200], !1);
  J.ANIM_FALL = new ta([12, 13, 14, 15], [100, 100, 100, 100]);
  J.ANIM_ROTATE = new ta([16, 17, 18, 19], [100, 100, 100, 100], !1);
  l.rotating = !1;
  l.rotation = 0;
  Za.TOGGLE_TIMER = 0.67;
  F.registry = [];
  F.start = F.register(-1, new Gb());
  F.finish = F.register(-2, new Ab());
  F.air = F.register(0, new xb());
  F.solid = F.register(1, new wa());
  F.stairs = F.register(2, new Fb());
  F.ramp = F.register(3, new $a());
  F.platform = F.register(4, new Cb());
  F.spikes = F.register(5, new Eb());
  F.saw = F.register(6, new Db());
  F.lever = F.register(8, new Za());
  F.door = F.register(9, new yb());
  F.number = F.register(7, new Bb());
  F.vent = F.register(10, new Hb());
  F.fan = F.register(11, new zb());
  ab.GRAVITY_MULT = 0.2;
  pa.WORLD_SIZE = 42;
  ha.fadeSpeed = 0.1;
  Aa.fakeCol = 30;
  Aa.fakeRow = 16;
  B.level1 = new ha();
  B.level2 = new Qb();
  B.level3 = new Rb();
  B.level4 = new Sb();
  B.level5 = new Tb();
  B.level6 = new Ub();
  B.level7 = new Vb();
  B.level8 = new Aa();
  B.level9 = new Wb();
  B.level10 = new Jb();
  B.level11 = new Kb();
  B.level12 = new Lb();
  B.level13 = new Mb();
  B.level14 = new Nb();
  B.level15 = new Ob();
  B.level16 = new Pb();
  B.list = [
    B.level1,
    B.level2,
    B.level3,
    B.level4,
    B.level5,
    B.level6,
    B.level7,
    B.level8,
    B.level9,
    B.level10,
    B.level11,
    B.level12,
    B.level13,
    B.level14,
    B.level15,
    B.level16
  ];
  B.unlocked = 0;
  B.speedrunBest = -1;
  U.TIME_TYPE = 30;
  U.TIME_STAY = 5250;
  U.TIME_FADE = 750;
  A.MOVE_SPEED = 4;
  A.showGrid = !0;
  A.editorLevel = new pa();
  w.continueTheme = !1;
  w.RESTART_DELAY = 1;
  w.DEATH_TIME = 1.5;
  w.DEATH_SHAKE_TIME = 0.85;
  w.DEATH_SHAKE_AMOUNT = 24;
  w.stopped = !1;
  w.canceled = !1;
  r.ALIGN_LEFT = 0;
  r.ALIGN_CENTER = 1;
  r.ALIGN_RIGHT = 2;
  r.X_ALIGN_LEFT = 0;
  r.X_ALIGN_CENTER = 1;
  r.X_ALIGN_RIGHT = 2;
  r.Y_ALIGN_TOP = 0;
  r.Y_ALIGN_MIDDLE = 1;
  r.Y_ALIGN_BOTTOM = 2;
  N.size2 = n.tileSize / 2;
  N.size4 = n.tileSize + 4;
  N.list = [
    F.air,
    F.solid,
    F.start,
    F.finish,
    F.stairs,
    F.ramp,
    F.platform,
    F.spikes,
    F.saw,
    F.lever,
    F.door,
    F.number,
    F.vent,
    F.fan
  ];
  N.selected = 1;
  Pa.HEIGHT = 48;
  R.HEIGHT = 48;
  R.EDGE_PAD = 14;
  R.EDGE_PAD_Y = 9;
  R.BTN_SPACE = 12;
  R.BTN_PAD = 8;
  R.TEXT_GREY = 0.75;
  R.THEMES = ["Theme A", "Theme B"];
  g.main();
})(
  "undefined" != typeof window
    ? window
    : "undefined" != typeof global
      ? global
      : "undefined" != typeof self
        ? self
        : this
);
