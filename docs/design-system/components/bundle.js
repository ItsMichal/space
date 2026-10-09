/* Paper — vanilla helpers for the liquid glass material and the lidar field.
   window.Paper.liquidGlass(el, opts)  -> attaches an SVG refraction filter sized to el
   window.Paper.lidarField(canvas, opts) -> starts the dot-art background, returns { stop, setPeers }
   No dependencies. The site ports these into React hooks with the same maths. */
(function () {
  var SVGNS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  function cssVar(el, name, fallback) {
    var v = getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
  }

  /* ---------- Liquid glass ----------
     Apple's material is a thin convex lens with a squircle rim: light passing
     near the edge bends inward (refraction), the body is frosted and
     saturated, and a specular rim catches light on the top-left.
     We model the rim height as a convex squircle h(t) = (1 - (1 - t)^4)^(1/4)
     over a band of width `bezel` from the edge, take its slope as the surface
     normal, and bend rays with Snell's law (n = 1.5). The resulting
     displacement is packed into R (x) and G (y) of a map image that drives
     feDisplacementMap on the backdrop. */
  function surfaceHeight(t) {
    var u = 1 - Math.min(Math.max(t, 0), 1);
    return Math.pow(1 - Math.pow(u, 4), 0.25);
  }

  function refractOffset(t, thickness) {
    var e = 0.001;
    var slope = (surfaceHeight(t + e) - surfaceHeight(t - e)) / (2 * e);
    var nAng = Math.atan(slope);
    var sinR = Math.sin(nAng) / 1.5;
    var rAng = nAng - Math.asin(sinR);
    return Math.tan(rAng) * thickness * surfaceHeight(t);
  }

  function sdRoundRect(px, py, w, h, r) {
    var qx = Math.abs(px - w / 2) - (w / 2 - r);
    var qy = Math.abs(py - h / 2) - (h / 2 - r);
    var ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    return Math.min(Math.max(qx, qy), 0) + Math.sqrt(ox * ox + oy * oy) - r;
  }

  function displacementMap(w, h, r, bezel) {
    var dpr = 1;
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(c.width, c.height);
    var d = img.data, max = 0, field = new Float32Array(c.width * c.height * 2);
    for (var y = 0; y < c.height; y++) {
      for (var x = 0; x < c.width; x++) {
        var px = x + 0.5, py = y + 0.5;
        var sd = sdRoundRect(px, py, w, h, r);
        var i = (y * c.width + x) * 2;
        if (sd > 0 || -sd > bezel) { field[i] = 0; field[i + 1] = 0; continue; }
        var t = -sd / bezel;
        var gx = sdRoundRect(px + 1, py, w, h, r) - sdRoundRect(px - 1, py, w, h, r);
        var gy = sdRoundRect(px, py + 1, w, h, r) - sdRoundRect(px, py - 1, w, h, r);
        var gl = Math.sqrt(gx * gx + gy * gy) || 1;
        var mag = refractOffset(t, bezel);
        field[i] = (-gx / gl) * mag;
        field[i + 1] = (-gy / gl) * mag;
        max = Math.max(max, Math.abs(field[i]), Math.abs(field[i + 1]));
      }
    }
    max = max || 1;
    for (var k = 0, p = 0; k < field.length; k += 2, p += 4) {
      d[p] = 128 + (field[k] / max) * 127;
      d[p + 1] = 128 + (field[k + 1] / max) * 127;
      d[p + 2] = 128;
      d[p + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { url: c.toDataURL(), maxOffset: max };
  }

  function supportsSvgBackdrop() {
    // Only Chromium applies url() filters inside backdrop-filter; Safari and Firefox get frost only.
    return /Chrome\//.test(navigator.userAgent);
  }

  function liquidGlass(el, opts) {
    opts = opts || {};
    var rect = el.getBoundingClientRect();
    var w = Math.round(rect.width), h = Math.round(rect.height);
    var r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 28, h / 2, w / 2);
    var bezel = opts.bezel || Math.min(r, 24);
    var scale = opts.refraction || parseFloat(cssVar(el, '--glass-refraction', '36'));
    var blur = opts.blur != null ? opts.blur : parseFloat(cssVar(el, '--glass-blur', '10'));
    var sat = opts.saturate || parseFloat(cssVar(el, '--glass-saturate', '1.6'));
    if (!supportsSvgBackdrop() || w < 4 || h < 4) {
      el.classList.add('lg--fallback');
      return function () {};
    }
    var map = displacementMap(w, h, r, bezel);
    var id = 'lg-filter-' + (++uid);
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.innerHTML =
      '<filter id="' + id + '" x="0" y="0" width="' + w + '" height="' + h + '" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">' +
      '<feGaussianBlur in="SourceGraphic" stdDeviation="' + blur / 4 + '" result="soft"/>' +
      '<feImage href="' + map.url + '" x="0" y="0" width="' + w + '" height="' + h + '" result="map"/>' +
      /* chromatic dispersion: red bends a touch more than blue */
      '<feDisplacementMap in="soft" in2="map" scale="' + scale * 1.06 + '" xChannelSelector="R" yChannelSelector="G" result="dr"/>' +
      '<feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>' +
      '<feDisplacementMap in="soft" in2="map" scale="' + scale + '" xChannelSelector="R" yChannelSelector="G" result="dg"/>' +
      '<feColorMatrix in="dg" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>' +
      '<feDisplacementMap in="soft" in2="map" scale="' + scale * 0.94 + '" xChannelSelector="R" yChannelSelector="G" result="db"/>' +
      '<feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>' +
      '<feBlend in="r" in2="g" mode="screen" result="rg"/>' +
      '<feBlend in="rg" in2="b" mode="screen" result="rgb"/>' +
      '<feColorMatrix in="rgb" type="saturate" values="' + sat + '"/>' +
      '</filter>';
    document.body.appendChild(svg);
    el.style.backdropFilter = 'url(#' + id + ')';
    el.style.webkitBackdropFilter = 'blur(' + blur + 'px) saturate(' + sat + ')';
    el.classList.add('lg--refract');
    return function () { svg.remove(); el.style.backdropFilter = ''; el.classList.remove('lg--refract'); };
  }

  /* ---------- Lidar field ----------
     A slow orbit over a scanned terrain rendered as points. Depth drives dot
     size and ink; a scan plane sweeps across and briefly lights points in the
     accent. Peers (other visitors) leave trails: each trail is a ring buffer
     of pointer samples drawn as fading dots in that visitor's presence color,
     snapped to the dot grid so trails read as part of the scan. */
  function lidarField(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var pitch = opts.pitch || 12;
    var peers = opts.peers || [];
    var raf = 0, t0 = performance.now(), running = true;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    function size() {
      var r = canvas.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
    }
    size();

    function terrain(x, z, t) {
      return 0.55 * Math.sin(x * 0.9 + t * 0.12) * Math.cos(z * 0.7) +
        0.35 * Math.sin(x * 2.1 - z * 1.3) +
        0.18 * Math.cos(x * 4.3 + z * 3.1 + t * 0.2);
    }

    function frame(now) {
      if (!running) return;
      var t = reduce ? 0 : (now - t0) / 1000;
      var W = canvas.width, H = canvas.height;
      var ink = cssVar(canvas, '--ink-faint', '#8b8984');
      var dot = cssVar(canvas, '--dot', '#c4c1b9');
      var accent = cssVar(canvas, '--accent', '#c7401c');
      ctx.clearRect(0, 0, W, H);
      var cols = Math.ceil(W / (pitch * dpr)) + 2;
      var rows = 46;
      var scanZ = ((t * 0.18) % 1.2) - 0.1;
      for (var j = 0; j < rows; j++) {
        var z = j / rows;
        var depth = 1 / (0.35 + z * 2.2);
        for (var i = 0; i < cols; i++) {
          var x = (i / cols - 0.5) * 6;
          var hgt = terrain(x, z * 6, t);
          var sx = W / 2 + x * depth * W * 0.32;
          var sy = H * 0.42 + (z * 1.1 - 0.15) * H * 0.62 - hgt * depth * H * 0.12;
          if (sx < -4 || sx > W + 4 || sy < -4 || sy > H + 4) continue;
          var near = Math.abs(z - scanZ) < 0.018;
          var s = Math.max(0.6, depth * 1.5) * dpr;
          ctx.globalAlpha = near ? 0.9 : Math.min(0.85, 0.18 + depth * 0.35);
          ctx.fillStyle = near ? accent : (depth > 0.9 ? ink : dot);
          ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
      var g = pitch * dpr;
      peers.forEach(function (p) {
        var color = cssVar(canvas, p.colorVar || '--presence-1', '#e0502a');
        var pts = p.trail;
        for (var k = 0; k < pts.length; k++) {
          var a = k / pts.length;
          var px = Math.round(pts[k][0] * W / g) * g, py = Math.round(pts[k][1] * H / g) * g;
          ctx.globalAlpha = a * a * 0.9;
          ctx.fillStyle = color;
          var r = (1 + a * 2.2) * dpr;
          ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        }
        if (pts.length) {
          var last = pts[pts.length - 1];
          ctx.globalAlpha = 1;
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(last[0] * W, last[1] * H, 4.5 * dpr, 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      if (!reduce) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', size);
    return {
      stop: function () { running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', size); },
      setPeers: function (next) { peers = next; }
    };
  }

  window.Paper = { liquidGlass: liquidGlass, lidarField: lidarField, displacementMap: displacementMap };
})();
