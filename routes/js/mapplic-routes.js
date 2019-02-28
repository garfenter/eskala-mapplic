/*
 * Mapplic Routes - Wayfinding extension by @sekler
 * Version 1.1
 * https://www.mapplic.com/routes
 */

jQuery(document).ready(function($) {
	var map = $('.mapplic-routes'),
		self = map.data('mapplic'),
		wayfinding = null;

	var buildFloors = function() {
		wayfinding = new Wayfinding().init();
		map.on('svgloaded', function(e, svg, id) {
			wayfinding.build(svg, id);
		});
	}

	if (self) buildFloors();
	else {
		map.on('mapstart', function(e, s) {
			self = s;
			buildFloors();
		});
	}

	// wayfinding
	function Wayfinding() {
		this.waypoints = [];
		this.element = null;
		this.path = null;
		this.el = null;
		this.fromselect = null;
		this.toselect = null;
		this.submit = null;
		this.button = null;
		this.timeouts = [];

		this.o = {
			opened: true,
			from: 'aquiestoy99',
			smoothing: 0,
			linecolor: '#ffffff',
			linewidth: 2,
			speed: 1
		};

		this.init = function() {
			// merging options with defaults
			this.o = $.extend(this.o, self.o.routes);

			this.el = this.markup();
			self.container.el.append(this.el);

			return this;
		}

		this.markup = function() {
			var s = this;

			// ui button
			this.button = $('<a></a>').attr('href', '#').addClass('mapplic-button mapplic-routes-button').appendTo(self.container.el);
			this.button.on('click touchstart', function(e) {
				e.preventDefault();
				s.el.show();
				$(this).hide();
			});

			if (self.o.clearbutton || self.o.zoombuttons) this.button.css('right', '40px');

			// panel
			this.el = $('<div></div>').addClass('mapplic-routes-panel');

			if (!this.o.from) {
				this.fromselect = $('<div></div').addClass('mapplic-routes-select').appendTo(this.el);
				$('<small>Desde:</small>').appendTo(this.fromselect);
				$('<div></div>').appendTo(this.fromselect);

				var swap = $('<div></div>').addClass('mapplic-routes-swap').appendTo(this.el);
				swap.on('click', function() {
					$(this).toggleClass('rotate');

					var from = $('> div', s.fromselect);
					$('> div', s.toselect).appendTo(s.fromselect);
					from.appendTo(s.toselect);
				});
			}
			else this.el.addClass('mapplic-routes-fromfixed');

			this.toselect = $('<div></div>').addClass('mapplic-routes-select').appendTo(this.el);
			$('<small>¿Hacia donde quieres ir?</small>').appendTo(this.toselect);
			$('<div></div').appendTo(this.toselect);


			$(document).on('click', '.mapplic-routes-select', function() {
				$('.active', s.el).removeClass('active');
				$(this).addClass('active');
			});

			this.submit = $('<a></a>').attr('href', '#').addClass('mapplic-routes-submit').attr('type', 'submit').appendTo(this.el);
			this.submit.on('click touchstart', function(e) {
				e.preventDefault();
				
				var f = s.getFrom(),
					t = s.getTo();

				$('.active', s.el).removeClass('active');

				if (f && t) s.showPath(f, t);
				else if (!f) s.fromselect.addClass('active');
				else if (!t) s.toselect.addClass('active');
				self.hideLocation();
			});

			var close = $('<div></div>').addClass('mapplic-routes-close').appendTo(this.el);
			close.on('click touchstart', function() {
				s.clear();
				$('.mapplic-routes-select > div', self.el).empty();

				s.hidePanel(s);
			});

			// list icon
			$(document).on('click touchstart', '.mapplic-routes-icon', function() {
				var t = $(this).closest('li').attr('data-location'),
					f = s.getFrom(),
					loc = $('<div></div>').addClass('mapplic-routes-loc').text($(this).siblings('a').children('h4').text()).attr('data-location', t);

				$('> div', s.toselect).empty().append(loc);

				s.showPanel(s);

				if (!f) s.fromselect.trigger('click');
				else {
					s.showPath(f, t);
					self.hideLocation();
				}
			});

			// active select
			self.el.on('locationopened', function(e, location) {
				var loc = $('<div></div>').addClass('mapplic-routes-loc').text(location.title).attr('data-location', location.id);
				$('.mapplic-routes-select.active > div', s.el).empty().append(loc);
			});

			// hidden by default
			if (!this.o.opened) this.hidePanel(this);

			return this.el;
		}

		// get from and to locations
		this.getFrom = function() {
			if (this.o.from) return this.o.from;
			else return $('.mapplic-routes-loc', this.fromselect).data('location');
		}

		this.getTo = function() {
			return $('.mapplic-routes-loc', this.toselect).data('location');
		}

		// show/hide panel
		this.showPanel = function(s) {
			s.el.show();
			s.button.hide();
		}

		this.hidePanel = function(s) {
			s.el.hide();
			s.button.show();

			$('.active', s.el).removeClass('active');
		}

		// build graph
		this.build = function(svg, fid) {
			var routes = $('[id^=route]', svg),
				s = this;

			this.element = routes;
			$('> *', routes).each(function() {
				var id = $(this).attr('id');
				switch (this.tagName) {
					case 'line':
						var a = s.addPoint($(this).attr('x1'), $(this).attr('y1'), id, routes, fid),
							b = s.addPoint($(this).attr('x2'), $(this).attr('y2'), id, routes, fid);
							val = s.distance(a, b);
						s.linkPoint(a, b, val);
						s.linkPoint(b, a, val);
						break;
					case 'polygon':
					case 'polyline':
						var pairs = $(this).attr('points').replace(/\s\s+/g, ' ').trim().split(' ');
						var first = null,
							prev = null;
						for (var i = 0; i < pairs.length; i++) {
							var pair = pairs[i].split(','),
								point = s.addPoint(pair[0], pair[1], id, routes, fid);

							if (prev) {
								var val = s.distance(point, prev);
								s.linkPoint(point, prev, val);
								s.linkPoint(prev, point, val);
							}
							else first = point;
							prev = point;
						}

						if (this.tagName == 'polygon') {
							var val = s.distance(first, point);
							s.linkPoint(point, first, val);
							s.linkPoint(first, point, val);
						}
						break;
					default:
						console.error('Invalid element in routes: ' + this.tagName + '. Valid types are line, polyline and polygon.');
				}
			});

			if (routes.length > 0) {
				for (var i = 0; i < this.waypoints.length; i++) {
					this.drawCircle(this.waypoints[i], '#b7a6bd');

					// linking floors
					if (this.waypoints[i].id && (this.waypoints[i].id.indexOf('pf-') == 0)) {
						var g = this.waypoints[i].id.split('-').slice(0,2).join('-');
						for (var j = i+1; j < this.waypoints.length; j++) {
							if (this.waypoints[j].id && this.waypoints[j].id.indexOf(g) == 0) {
								s.linkPoint(this.waypoints[i], this.waypoints[j], 20);
								s.linkPoint(this.waypoints[j], this.waypoints[i], 20);
							}
						}
					}
				}
			}

			// auto assign points to location shapes
			var lp = []; // location points

			$('[id^=landmark] > *[points], [id^=landmark] > g > *[points]', svg).each(function() {
				var pairs = $(this).attr('points').replace(/\s\s+/g, ' ').trim().split(' '),
					id = $(this).attr('id');

				if (id) {
					for (var i = 0; i < pairs.length; i++) {
						var pair = pairs[i].split(',');
						lp.push({
							id: id,
							x: pair[0],
							y: pair[1]
						});
					}
				}
			});

			for (var i = 0; i < this.waypoints.length; i++) {
				if (this.waypoints[i].n.length == 1 && !this.waypoints[i].id) {
					for (var j = 0; j < lp.length; j++) {
						if (lp[j].x == this.waypoints[i].x && lp[j].y == this.waypoints[i].y) {
							this.waypoints[i].id = 'p-' + lp[j].id;
							this.addListIcon(lp[j].id);
						}
					}
				}
			}

		}

		this.showPath = function(a, b) {
			var wpa = this.getPoints(a),
				wpb = this.getPoints(b);

			if (!wpa || !wpb) return false;

			var path = this.shortestPath(wpa, wpb),
				start = 0,
				dist = 0;

			this.clear();

			// multifloor support
			for (var i = 1; i < path.length; i++) {
				if (path[i-1].fid != path[i].fid) {
					this.showSubPath(path.slice(start, i), path[i].dist - dist, dist, path[start].fid);
					dist = path[i].dist;
					start = i;
				}
			}

			// last or only floor
			MapplicInstance.tooltip.show(MapplicInstance.actualLocation);
			this.showSubPath(path.slice(start, path.length), path[path.length - 1].dist - dist, dist, path[start].fid, true);
		}

		this.showSubPath = function(subpath, dist, dur, fid, last) {
			var s = this;
			var t = setTimeout(function() {
				self.switchLevel(fid);
				if(last){
					MapplicInstance.tooltip.show(MapplicInstance.actualLocation);		
				}
				var path = s.drawPath(subpath, dist),
					bbox = path[0].getBBox();
			}, dur * 10 / s.o.speed + s.timeouts.length * 600); // 600ms delay
			s.timeouts.push(t);
		}

		this.addListIcon = function(id) {
			$('<div></div>').addClass('mapplic-routes-icon').appendTo($('.mapplic-list-location[data-location=' + id + ']', self.el));
		}

		this.bboxZoom = function(bbox) {
			var padding = 40,
				wr = self.container.el.width() / (bbox.width + padding),
				hr = self.container.el.height() / (bbox.height + padding);

			return Math.min(wr, hr);
		}

		this.drawCircle = function(wp, color) {
			color = typeof color !== 'undefined' ? color : 'red';
			var circle = $(this.svg('circle')).attr('cx', wp.x)
				.attr('cy', wp.y)
				.attr('r', 2)
				.attr('fill', color)
				.attr('stroke', 'none')
				.appendTo(wp.floor);
		}

		this.linePoint = function(a, b) {
			var xlen = parseFloat(b.x) - parseFloat(a.x),
				ylen = parseFloat(b.y) - parseFloat(a.y),
				len = Math.abs(a.dist-b.dist);
				size = Math.min(this.o.smoothing, len/2),
				r = size / len;

			return {
				x: parseFloat(a.x) + xlen * r,
				y: parseFloat(a.y) + ylen * r
			}
		}

		// the route
		this.drawPath = function(list, dist) {
			var d = 'M ' + list[0].x + ',' + list[0].y;

			for (var i = 0; i < list.length; i++) {
				if (this.o.smoothing && (i>0 && i<list.length-1)) {
					var p = this.linePoint(list[i], list[i-1]);
					d += ' L' + p.x + ',' + p.y;
					d += ' Q' + list[i].x + ',' + list[i].y;
					var p = this.linePoint(list[i], list[i+1]);
					d += ' ' + p.x + ',' + p.y;
				}
				else d += ' L' + list[i].x + ',' + list[i].y;
			}

			this.path = $(this.svg('path'))
				.attr('class', 'mapplic-routes-path')
				.attr('stroke', this.o.linecolor)
				.attr('stroke-width', this.o.linewidth)
				.attr('d', d)
				.appendTo(list[0].floor.parent());

			// animation
			var p = this.path.get(0),
				length = p.getTotalLength();
			
			p.style.strokeDasharray = length + ' ' + length;
			p.style.strokeDashoffset = length;
			p.getBoundingClientRect();
			p.style.transition = p.style.WebkitTransition = 'stroke-dashoffset ' + dist / 100 / this.o.speed + 's ease-in-out 0.4s'; // 400ms delay
			p.style.strokeDashoffset = '0';

			return this.path;
		}

		// clear route
		this.clear = function() {
			$('.mapplic-routes-path', map).remove();
			for (var i = 0; i < this.timeouts.length; i++) { clearTimeout(this.timeouts[i]); }
			this.timeouts = [];
		}

		this.shortestPath = function(a, b) {
			for (var i = 0; i < this.waypoints.length; i++) {
				this.waypoints[i].dist = Number.POSITIVE_INFINITY;
				this.waypoints[i].prev = undefined;
			}

			// dijkstra
			for (var i = 0; i < a.length; i++) this.waypoints[a[i]].dist = 0;
			var q = this.waypoints.slice();

			while (q.length > 0) {
				var min = Number.POSITIVE_INFINITY,
					u = 0;
				for (var i = 0; i < q.length; i++) {
					if (q[i].dist < min) {
						u = i;
						min = q[i].dist;
					}
				}
				var p = q[u];
				q.splice(u, 1);
				for (var i = 0; i < p.n.length; i++) {
					var alt = p.dist + p.n[i].val;
					if (alt < p.n[i].to.dist) {
						p.n[i].to.dist = alt;
						p.n[i].to.prev = p;
					}
				}
			}

			var min = Number.POSITIVE_INFINITY,
				target = null,
				path = [];

			for (var i = 0; i < b.length; i++) {
				if (this.waypoints[b[i]].dist < min) {
					target = this.waypoints[b[i]];
					min = target.dist;
				}
			}
			path.push(target);

			while (target.prev !== undefined) {
				target = target.prev;
				path.unshift(target);
			}
			return path;
		}

		this.addPoint = function(x, y, id, floor, fid) {
			var point = this.pointExists(this.waypoints, x, y);
			if (!point) {
				this.waypoints.push({
					id: id,
					x: x,
					y: y,
					floor: floor,
					fid: fid,
					n: []
				});
				point = this.waypoints[this.waypoints.length - 1];
			
				// list button
				if (id) this.addListIcon(id.replace('p-', ''));
			}

			return point;
		}

		this.getPoints = function(id) {
			var p = [];
			for (var i = 0; i < this.waypoints.length; i++) if (this.waypoints[i].id == ('p-' + id)) p.push(i);

			if (p.length > 0) return p;
			else {
				console.error('There is no path to location: ' + id);
				return null;
			}
		}

		this.linkPoint = function(a, b, val) {
			val = typeof val !== 'undefined' ? val : 0;
			if (!this.pointExists(a.n, b.x, b.y)) {
				a.n.push({
					to: b,
					val: val
				});
			}
		}

		this.pointExists = function(list, x, y) {
			for (var i = 0; i < list.length; i++) {
				if ((list[i].x == parseFloat(x)) && (list[i].y == parseFloat(y))) {
					return list[i];
				}
			}
			return null;
		}

		this.distance = function(a, b) {
			return Math.sqrt(Math.pow((a.x - b.x), 2) + Math.pow((a.y - b.y), 2));
		}

		this.svg = function(tag) {
			return document.createElementNS('http://www.w3.org/2000/svg', tag);
		}
	}

});