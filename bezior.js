/***************************************************
 *                                                 *
 *   Example source - this is public domain code   *
 *                                                 *
 ***************************************************/

        void setupCurve() {
          //setupDefaultCubic();
          Point[] points = {
            new Point(65,25),
            new Point(5,150),
            new Point(80,290),
            new Point(220,235),
            new Point(250,150),
            new Point(135,125),
          };
          curves.add(new BezierCurve(points));
          reorder();
          animate();
          pause();
          span();
        }

        void drawCurve(BezierCurve curve) {
          curve.draw();
          Point p = curve.getPoint(t);
          ellipse(p.x, p.y, 5, 5);
          drawSpan(curve, t);
        }

String getSketchLabel() {
  return "Figure 6.1: Traversing a curve using de Casteljau's algorithm";
}



/***************************************************
 *                                                 *
 *    Preset functions for simple 1x1 sketching    *
 *                                                 *
 ***************************************************/

/**
 * set up the screen
 */
void setupScreen() {
  size(dim,dim);
  labels();
  controls();
  additionals();
  noConnect();
}

/**
 * Actual draw code
 */
void drawFunction() {
  BezierCurve curve = curves.get(0);
  drawCurve(curve);
}

/***************************************************
 *                                                 *
 *      A "Point" class, a bit like PVector but    *
 *      with a completely different API.           *
 *                                                 *
 ***************************************************/

// Point class. Utter boilerplate and not interesting.
class Point {
  float x,y,d;
  Point normal = null;

  Point(float x, float y) {
    moveTo(x,y);
  }

  Point(Point o) {
    moveTo(o.x, o.y);
    normal = normalize();
  }

  // scale
  Point scale(float f) {
    return new Point(f*x,f*y);
  }

  // normalize
  Point normalize() {
    return new Point(x/d,y/d);
  }

  // repositioning
  void moveTo(float _x, float _y) { x=_x; y=_y; d=sqrt(x*x+y*y); }
  void moveTo(float _x, float _y, float ratio) { x+=(_x-x)*ratio; y+=(_y-y)*ratio; d=sqrt(x*x+y*y); }
  void moveBy(float _x, float _y) { moveTo(x+_x, y+_y); }

  // rotate this point w.r.t. another point
  Point rotateOver(Point o, float angle) {
    float nx = x-o.x, ny = y-o.y,
          mx = nx*cos(angle) - ny*sin(angle),
          my = nx*sin(angle) + ny*cos(angle);
    moveTo(mx+o.x,my+o.y);
    return this;
  }

  // reflect a point through this point
  Point reflect(Point original) {
    return new Point(2*x - original.x, 2*y - original.y);
  }

  // does this point coincide with coordinate mx/my?
  boolean over(float mx, float my) {
    return abs(mx-x)<5&&abs(my-y)<5;
  }

  // ye olde tostringe
  String toString() { return x+"/"+y+(normal!=null ? " (normal: "+normal.toString()+")" : ""); }

  // point draw functions
  void draw() { ellipse(x,y,3,3); }
  void draw(String label) {
    draw();
    if(showLabels) {
      fill(0);
      text(label+"("+(int)x+","+(int)y+")",x+10,y);
      noFill();
    }
  }
}


/***************************************************
 *                                                 *
 *      A generic Bezier curve implementation      *
 *                                                 *
 ***************************************************/

/**
 * Bezier curve class (of any degree)
 */
class BezierCurve {
  int LUT_resolution;
  int order;
  Point[] points,              // the control points for this curve
          abc = new Point[3],  // the "ABC" points. Only for 2nd and 3rd order curves
          span,                // de Casteljau's spanning lines for some t=...
          left_split,          // for any span, these are the control points for the subcurve [0,t]
          right_split,         // for any span, these are the control points for the subcurve [t,1]
          normals;             // the normal vectors for each control point.
  // LUT for the point x/y values and t-at-x/y values
  float[] x_values,
          y_values,
          LUT_x,
          LUT_y ,
          ratios, // the distance from the start, as ratios, for each control point projected onto the curve
          originalInterval = {0,1};
  // for drawing the curve, we use integer lookups
  int[] draw_x = new int[LUT_resolution],
        draw_y = new int[LUT_resolution];
  float span_t = -1,     // indicates the 't' value for which span/left/right was last computed
        curveLength,     // the arc length of this curve, computed on construction
        bias = 0;        // are control points are on one side of the baseline? -1/1 means yes (sign indicates left/right), 0 means no.


  // lower order Bezier curve, if this curve is an elevation
  BezierCurve generator = null;

  // reserved
  protected BezierCurve() {}

  /**
   * construct a typical curve
   */
  BezierCurve(Point[] points) {
    this(points, true);
  }

  BezierCurve(Point[] points, boolean copyPoints) {
    int L = points.length;
    order = L-1;
    if(copyPoints) {
      this.points = new Point[L];
      for(int p=0; p<L; p++) {
        this.points[p] = new Point(points[p].x, points[p].y);
      }
    } else { this.points = points; }
    LUT_resolution = 1 + (int) (400 * log(order)/log(4));
    LUT_x = new float[LUT_resolution];
    LUT_y = new float[LUT_resolution];
    draw_x = new int[LUT_resolution];
    draw_y = new int[LUT_resolution];
    x_values = new float[L];
    y_values = new float[L];
    update();
  }

  /**
   * Update all the cachable information
   * - x/y lookup tables
   * - coordinates in x and y dimensions
   * - curve length
   * - control normals
   */
  void update() {
    span_t = -1;
    generator = null;
    // Split up "point" x- and y- components for quick lookup.
    for(int i=0, last=points.length; i<last; i++) {
      x_values[i] = points[i].x;
      y_values[i] = points[i].y;
    }
    // Create lookup tables for resolving coordinate -> 't' value
    // as well as the int-cast screen point for that 't' value.
    float t, r=(float)(LUT_resolution-1);
    for(int idx=0; idx<LUT_resolution; idx++) {
      t = idx/r;
      // lookup values
      LUT_x[idx] = getXValue(t);
      LUT_y[idx] = getYValue(t);
      // squashed values, for drawing
      draw_x[idx] = (int)round(LUT_x[idx]);
      draw_y[idx] = (int)round(LUT_y[idx]);
    }
    // Determine curve length
    curveLength = (order==1? dist(x_values[0],y_values[0],x_values[1],y_values[1]) : comp.getArcLength(x_values, y_values));
    // Figure out the normals along this curve
    // for each control point.
    normals = new Point[order+1];
    normals[0] = getNormal(0);
    normals[order] = getNormal(1);
    ratios = new float[order+1];
    ratios[0] = 0;
    for(int i=1; i<=order; i++) {
      t = getPointProjection(points[i]);
      normals[i] = getNormal(t);
      int mindist_idx = int(t*LUT_resolution);
      float partialLength = (order==1 ? dist(x_values[0],y_values[0],LUT_x[mindist_idx],LUT_y[mindist_idx])
                                       : comp.getArcLength(t, x_values, y_values));
      ratios[i] = partialLength/curveLength;
    }
    ratios[order] = 1;
    // Is this curve biased? i.e. are all the control
    // points on one side of the baseline?
    if(order>1) {
      bias = comp.getSide(points[0],points[order],points[1]);
      for(int i=2; i<order; i++) {
        if(comp.getSide(points[0],points[order],points[i])!=bias) {
          bias = 0;
          break; }}}
  }

  /**
   * Get the first point in this curve
   */
  Point getStart() { return points[0]; }

  /**
   * Get the last point in this curve
   */
  Point getEnd() { return points[order]; }

  /**
   * find an approximate t value that acts as the control's
   * projection onto the curve, towards the origin.
   */
  float getPointProjection(Point p) {
    float t=0.5, pdist, mindist=9999999, tp, tn;
    int mindist_idx=0;
    // find a reasonable initial "t"
    for(int idx=0; idx<LUT_resolution; idx+=1) {
      pdist = dist(p.x, p.y, LUT_x[idx], LUT_y[idx]);
      if(pdist<mindist) {
        mindist = pdist;
        mindist_idx = idx;
        t = (float)idx/(float)LUT_resolution; }}
    t = refineProjection(p, t, mindist, 1.0/(1.01*LUT_resolution));
    return t;
  }

  /**
   * Refine a point projection's [t] value.
   */
  float refineProjection(Point p, float t, float distance, float precision) {
    if(precision < 0.0001) return t;
    // refinement
    float prev_t = t-precision,
          next_t = t+precision;
    Point prev = getPoint(prev_t),
          next = getPoint(next_t);
    float prev_distance = dist(p.x, p.y, prev.x, prev.y),
          next_distance = dist(p.x, p.y, next.x, next.y);
    // smaller distances?
    if(prev_t >= 0 && prev_distance < distance) { return refineProjection(p, prev_t, prev_distance, precision); }
    if(next_t <= 1 && next_distance < distance) { return refineProjection(p, next_t, next_distance, precision); }
    // larger distances
    return refineProjection(p, t, distance, precision/2.0);
  }

  // how close are these two curves?
  float getSimilarity(BezierCurve other) {
    float diff = 0, dx, dy, d;
    for(int i=0; i<points.length; i++) {
      dx = points[i].x - other.points[i].x;
      dy = points[i].y - other.points[i].y;
      d = sqrt(dx*dx+dy*dy);
      diff += d;
    }
    return diff;
  }

  /**
   * Get values
   */
  float getXValue(float t) { return comp.getValue(t, x_values); }
  float getYValue(float t) { return comp.getValue(t, y_values); }
  Point getPoint(float t)  { return new Point(getXValue(t), getYValue(t)); }

  /**
   * Get derivative values
   */
  float getDXValue(float t) { return comp.getDerivative(1, t, x_values);  }
  float getDYValue(float t) { return comp.getDerivative(1, t, y_values);  }
  Point getDerivativePoint(float t)  { return new Point(getDXValue(t), getDYValue(t)); }
  Point[] getSpanLines(float t)  {
    Point[] span = generateSpan(t);
    int prev = span.length-3, b = span.length-1, next = span.length-2;
    Point p1 = new Point(span[prev].x-span[b].x, span[prev].y-span[b].y);
    Point p2 = new Point(span[next].x-span[b].x, span[next].y-span[b].y);
    return new Point[]{p1, p2};
  }

  /**
   * Get second derivative values
   */
  float getD2XValue(float t) { return comp.getDerivative(2, t, x_values);   }
  float getD2YValue(float t) { return comp.getDerivative(2, t, y_values);   }
  Point getSecondDerivativePoint(float t)  { return new Point(getD2XValue(t), getD2YValue(t)); }

  /**
   * get a point-normal
   */
  Point getNormal(float t) {
    float dx = getDXValue(t),
          dy = getDYValue(t),
          a = -PI/2,
          ca = cos(a),
          sa = sin(a),
          nx = dx*ca - dy*sa,
          ny = dx*sa + dy*ca,
          dst = sqrt(nx*nx+ny*ny);
    return new Point(nx/dst, ny/dst);
  }

  /**
   * Get the spanning lines for this curve at t = ...
   * While we do this, we also calculate the A/B/C points,
   * as well as the split curves for [t], since this requires
   * the same information.
   */
  Point[] generateSpan(float t) {
    span_t = t;
    left_split = new Point[order+1];
    right_split = new Point[order+1];
    int l = 0, r = order;
    Point[] span = new Point[comp.markers(order+1)];
    arrayCopy(points,0,span,0,points.length);
    Point p1, p2, p3;
    int next = points.length;
    for(int c = order; c>0; c--) {
      left_split[l++] = span[next-c-1];
      for(int i = 0; i<c; i++) {
        p1 = span[next-c-1];
        p2 = span[next-c];
        p3 = new Point(lerp(p1.x, p2.x, t), lerp(p1.y, p2.y, t));
        if(c==3 && i==1) { abc[0] = p3; }
        span[next++] = p3;
      }
      right_split[r--] = span[next-c-1];
    };
    left_split[l] = span[next-1];
    right_split[0] = span[next-1];
    // fill in the ABC array
    int last = span.length - 1;
    abc[0] = (order%2==0 ? span[order/2] : span[order + order - 1]);
    abc[1] = span[last];
    abc[2] = comp.getProjection(abc[0], abc[1], span[0], span[order]);
    // and finally, return the span lines
    return span;
  }

  /**
   * compute the bounding box for a curve
   */
  Point[] generateBoundingBox() {
    float[] inflections = getInflections();
    float mx=999999, MX=-999999, my=mx, MY=MX, x, y, t;
    for(int i=0; i<inflections.length; i++) {
      t = inflections[i];
      x = getXValue(t);
      y = getYValue(t);
      if(x < mx) { mx = x; }
      if(x > MX) { MX = x; }
      if(y < my) { my = y; }
      if(y > MY) { MY = y; }
    }
    Point[] bbox = {new Point(mx,my), new Point(MX,my), new Point(MX,MY), new Point(mx,MY)};
    return bbox;
  }

  /**
   * Get the bounding box area
   */
  float getArea() {
    Point[] bbox = generateBoundingBox();
    float dx = bbox[2].x - bbox[0].x,
          dy = bbox[2].y - bbox[0].y,
          A = dx*dy;
    return A;
  }

  /**
   * Generate a bounding box for the aligned curve
   */
  Point[] generateTightBoundingBox() {
    float ox = points[0].x,
          oy = points[0].y,
          angle = atan2(points[order].y - points[0].y, points[order].x - points[0].x) + PI,
          ca = cos(angle),
          sa = sin(angle),
          nx, ny;
    Point[] bbox = align().generateBoundingBox();
    for(Point p: bbox) {
      nx = (p.x * ca - p.y * sa) + ox;
      ny = (p.x * sa + p.y * ca) + oy;
      p.x = nx;
      p.y = ny;
    }
    return bbox;
  }

  /**
   * Is there an overlap between these two curves,
   * based on their bounding boxes?
   */
  boolean hasBoundOverlapWith(BezierCurve other) {
    Point[] bbox = generateBoundingBox(),
            obbox = other.generateBoundingBox();
    float dx = abs(bbox[2].x - bbox[0].x)/2,
           dy = abs(bbox[2].y - bbox[0].y)/2,
           odx = abs(obbox[2].x - obbox[0].x)/2,
           ody = abs(obbox[2].y - obbox[0].y)/2,
           mx = bbox[0].x + dx,
           my = bbox[0].y + dy,
           omx = obbox[0].x + odx,
           omy = obbox[0].y + ody,
           distx = abs(mx-omx),
           disty = abs(my-omy),
           tx = dx + odx,
           ty = dy + ody;
    return distx < tx && disty < ty;
  }

  /**
   * Just the X curvature
   */
  BezierCurve justX(float h) {
    int L = points.length, l = L - 1;
    Point[] newPoints = new Point[L];
    for(int i=0; i<L; i++) {
      newPoints[i] = new Point(i*h/l, points[i].x);
    }
    return new BezierCurve(newPoints);
  }

  /**
   * Just the Y curvature
   */
  BezierCurve justY(float h) {
    int L = points.length, l = L - 1;
    Point[] newPoints = new Point[L];
    for(int i=0; i<L; i++) {
      newPoints[i] = new Point(i*h/l, points[i].y);
    }
    return new BezierCurve(newPoints);
  }

  /**
   * Reverse this curve
   */
  void reverse() {
    Point[] newPoints = new Point[points.length];
    for(int i=0; i<points.length; i++) {
      newPoints[order-i] = points[i];
    }
    points = newPoints;
    update();
  }

  /**
   * Determine whether all control points are on
   * one side of the baseline. If so, this curve
   * is biased, making certain computations easier.
   */
  boolean isBiased() { return bias != 0; }

  /**
   * return the arc length for this curve.
   */
  float getCurveLength() { return curveLength; }
  float getCurveLength(int n) { return comp.getArcLength(1, n, x_values, y_values); }

  /**
   * Get the A/B/C points for this curve. These are only
   * meaningful for quadratic and cubic curves.
   */
  Point[] getABC(float t) {
    generateSpan(t);
    return abc;
  }

  /**
   * Get the distance of the curve's midpoint to the
   * baseline (start-end). The smaller this value is,
   * the more linear a simple curve will be. For
   * non-simple curves, this value is relatively useless.
   */
  float getScaleAngle() {
    Point p1 = getNormal(0), p2 = getNormal(1);
    return abs(atan2(p1.x*p2.y - p2.x*p1.y, p1.x*p2.x + p1.y*p2.y) % 2*PI);
  }

  /**
   * Get the t-interval, with respects to the ancestral curve.
   */
  float[] getInterval() {
    return originalInterval;
  }

  /**
   * Bound when splitting curves: mark which [t] values on the original curve
   * the start and end of this curve correspond to. Note that if this curve is
   * the result of multiple splits, the "original" is the ancestral curve
   * that the very first split() was called on.
   */
  void setOriginalT(float d1, float d2) {
    originalInterval[0] = d1;
    originalInterval[1] = d2;
  }


  /**
   * Split in half
   */
  BezierCurve[] split() {
    BezierCurve[] subcurves = split(0.5);
    float mid = (originalInterval[0] + originalInterval[1])/2;
    subcurves[0].setOriginalT(originalInterval[0], mid);
    subcurves[1].setOriginalT(mid, originalInterval[1]);
    return subcurves;
  }

  /**
   * Split into two curves at some [t] value
   */
  BezierCurve[] split(float t) {
    if (t != span_t) { generateSpan(t); }
    BezierCurve[] subcurves = {new BezierCurve(left_split), new BezierCurve(right_split)};
    return subcurves;
  }

  /**
   * Get the segment from t1 to t2 as new curve
   */
  BezierCurve split(float t1, float t2) {
    BezierCurve segment;
    if(t1==0) { segment = split(t2)[0]; }
    else if(t2==1) { segment = split(t1)[1]; }
    else {
      BezierCurve[] subcurves = split(t1);
      t2 = (t2-t1)/(1-t1);
      subcurves = subcurves[1].split(t2);
      segment = subcurves[0];
    }
    return segment;
  }

  /**
   * Scale this curve. Note that this is NOT
   * the same as offsetting the curve. We're
   * literally just scaling the coordinates.
   */
  BezierCurve scale(float f) {
    int L = points.length;
    Point[] scaled = new Point[L];
    Point p;
    for (int i=0; i<L; i++) {
      p = points[i];
      scaled[i] = new Point(f * p.x, f * p.y);
    }
    return new BezierCurve(scaled);
  }

  /**
   * Align this curve: rotate it so that the first and last coordinates line up,
   * and shift it so that the first coordinate is (0,0), which simplifies the formulae.
   */
  BezierCurve align() {
    return align(points[0], points[order]);
  }

  /**
   * Align this curve to a line defined by two points: rotate it so that the line
   * start is on (0,0), and rotate it so the angle is 0.
   */
  BezierCurve align(Point start, Point end) {
    float angle = atan2(end.y - start.y, end.x - start.x) + PI,
          ca = cos(-angle),
          sa = sin(-angle),
          ox = start.x,
          oy = start.y;
    int L = points.length;
    Point[] aligned = new Point[L];
    Point p = points[0];
    for (int i=0; i<L; i++) {
      p = points[i];
      p = new Point(ca * (p.x-ox) - sa * (p.y-oy), sa * (p.x-ox) + ca * (p.y-oy));
      aligned[i] = p;
    }
    return new BezierCurve(aligned);
  }

  /**
   * Normalise this curve: scale all coordinate to within a unit rectangle.
   */
  BezierCurve normalize() {
    int L = points.length;
    Point[] normalised = new Point[L];
    Point p = points[0];
    float mx = 999999, my = mx,
          MX = -999999, MY = MX;
    for (int i=0; i<L; i++) {
      p = points[i];
      if(p.x<mx) { mx = p.x; }
      if(p.y<my) { my = p.y; }
      if(p.x>MX) { MX = p.x; }
      if(p.y>MY) { MY = p.y; }
      normalised[i] = p;
    }
    for (int i=0; i<L; i++) {
      normalised[i].x = map(normalised[i].x,  mx,MX,  0,1);
      normalised[i].y = map(normalised[i].y,  my,MY,  0,1);
    }
    return new BezierCurve(normalised);
  }

  /**
   * Elevate this curve by one order
   */
  BezierCurve elevate() {
    int L = points.length;
    Point[] elevatedPoints = new Point[L+1];
    elevatedPoints[0] = new Point(LUT_x[0], LUT_y[0]);
    float np1 = order+1, nx, ny;
    for(int i=1; i<L; i++) {
      nx = (i/np1) * x_values[i-1] + (np1-i)/np1 * x_values[i];
      ny = (i/np1) * y_values[i-1] + (np1-i)/np1 * y_values[i];
      elevatedPoints[i] = new Point(nx,ny);
    }
    elevatedPoints[L] = new Point(x_values[L-1], y_values[L-1]);
    BezierCurve b = new BezierCurve(elevatedPoints);
    b.setLower(this);
    return b;
  }

  /**
   * Fix the "lower" degree curve for this Bezier curve.
   * The moment any of the curve points are modified, this
   * lower degree curve is discarded.
   */
  void setLower(BezierCurve parent) { generator = parent; }

  /**
   * Lower the curve's complexity, if we can. Which basically
   * means "if this curve was raised without the coordinates
   * having been touched, since". Otherwise we fake it, by
   *
   */
  BezierCurve lower() {
    if(generator!=null) return generator;
    if(order==1) return this;
    Point[] newPoints = new Point[order];
    float x, y;
    newPoints[0] = points[0];
    // FIXME: this is not very good lowering =)
    for(int i=1; i<order; i++) {
      x = lerp(points[i-1].x,points[i].x,0.5);
      y = lerp(points[i-1].y,points[i].y,0.5);
      newPoints[i] = new Point(x,y);
    }
    newPoints[order-1] = points[order];
    return new BezierCurve(newPoints);
  }

  /**
   * Get all 't' values for which this curve inflects.
   * NOTE: this is an expensive operation!
   */
  float[] getInflections() {
    float[] ret = {};
    ArrayList<Float> t_values = new ArrayList<Float>();
    t_values.add(0.0);
    t_values.add(1.0);
    float[] roots;
    // get first derivative roots
    roots = comp.findAllRoots(1, x_values);
    for(float t: roots) { if(0 < t && t < 1) { t_values.add(t); }}
    roots = comp.findAllRoots(1, y_values);
    for(float t: roots) { if(0 < t && t < 1) { t_values.add(t); }}
    // get second derivative roots
    if(order>2) {
      roots = comp.findAllRoots(2, x_values);
      for(float t: roots) { if(0 < t && t < 1) { t_values.add(t); }}
      roots = comp.findAllRoots(2, y_values);
      for(float t: roots) { if(0 < t && t < 1) { t_values.add(t); }}
    }
    // sort roots
    ret = new float[t_values.size()];
    for(int i=0; i<ret.length; i++) { ret[i] = t_values.get(i); }
    ret = sort(ret);
    // remove duplicates
    t_values = new ArrayList<Float>();
    for(float f: ret) { if(!t_values.contains(f)) { t_values.add(f); }}
    ret = new float[t_values.size()];
    for(int i=0; i<ret.length; i++) { ret[i] = t_values.get(i); }
    if(ret.length > (2*order+2)) {
      String errMsg = "ERROR: getInflections is returning way too many roots ("+ret.length+")";
      if(javascript != null) { javascript.console.log(errMsg); } else { println(errMsg); }
      return new float[0];
    }
    return ret;
  }

  /**
   * Add a slice to this curve's offset subcurves. If a slice
   * is too complex (i.e. has more than one inflection point)
   * we split it up into two simpler curves, because otherwise
   * normal-based offsetting will look really wrong.
   */
  void addSlices(ArrayList<BezierCurve> slices, BezierCurve c) {
    BezierCurve bc = c.align();
    float[] inflections = bc.getInflections();
    if(inflections.length>3) {
      BezierCurve[] splitup = c.split(0.5);
      addSlices(slices, splitup[0]);
      addSlices(slices, splitup[1]);
    } else { slices.add(c); }
  }

  /**
   * Slice up this curve along its inflection points.
   */
  ArrayList<BezierCurve> getSlices() {
    float[] inflections = align().getInflections();
    ArrayList<BezierCurve> slices = new ArrayList<BezierCurve>();
    for(int i=0, L=inflections.length-1; i<L; i++) {
      addSlices(slices, split(inflections[i], inflections[i+1]));
    }
    return slices;
  }

  /**
   * Graduated-offset this curve along its normals,
   * without segmenting it.
   */
  BezierCurve simpleOffset(float offset) { return simpleOffset(offset,1,1); }
  BezierCurve simpleOffset(float offset, float start, float end) {
    float moveStart = map(start,0,1,0,offset),
          moveEnd =  map(end,0,1,0,offset),
          dx, dy;
    Point[] newPoints = new Point[order+1];
    for(int i=0; i<=order; i++) {
      dx = map(ratios[i],0,1,moveStart,moveEnd);
      dy = map(ratios[i],0,1,moveStart,moveEnd);
      dx *= normals[i].x;
      dy *= normals[i].y;
      newPoints[i] = new Point(points[i].x + dx, points[i].y + dy); }
    return new BezierCurve(newPoints);
  }

  /**
   * Offset the entire curve by some interpolating distance,
   * starting at offset [start] and ending at offset [end].
   * Segmenting it based on inflection points.
   */
  BezierCurve[] offset(float distance) { return offset(distance, 1, 1); }
  BezierCurve[] offset(float distance, float start, float end) {
    BezierCurve segment;
    ArrayList<BezierCurve> segments = new ArrayList<BezierCurve>(),
                           slices = getSlices();
    float S = 0, L = getCurveLength(), s, e;
    for(int b=0; b<slices.size(); b++) {
      segment = slices.get(b);
      s = map(S, 0,L, start,end);
      S += segment.getCurveLength();
      e = map(S, 0,L, start,end);
      segment = segment.simpleOffset(distance, s, e);
      segments.add(segment);
    }
    return makeOffsetArray(segments);
  }

  // arraylist -> [], with normal correction if needed.
  private BezierCurve[] makeOffsetArray(ArrayList<BezierCurve> segments) {
    // Step 3: convert the arraylist to an array, and return
    BezierCurve[] offsetCurve = new BezierCurve[segments.size()];
    for(int b=0; b<segments.size(); b++) {
      offsetCurve[b] = segments.get(b);
      if(b>0 && !simplifiedFunctions) {
        // We used estimations for the control-projections,
        // so the start and end normals may in fact be wrong.
        // make sure they line up by "pulling them together".
        correctIfNeeded(offsetCurve[b-1], offsetCurve[b]);
      }
    }
    // and we're done!
    return offsetCurve;
  }

  /**
   * When offsetting curves, it's possible that on strong
   * curvatures the normals for start and end points of
   * adjacent segments do not line up. In those cases, we
   * need to rotate the normals, which means moving the
   * control points, to ensure a continuously differentiable
   * polybezier.
   */
  void correctIfNeeded(BezierCurve prev, BezierCurve next) {
    float p2 = PI/2;
    Point n1 = prev.getNormal(1),
          n2 = next.getNormal(0),
          n2p = new Point(n2.x*cos(p2)-n2.y*sin(p2), n2.x*sin(p2)+n2.y*cos(p2));
    float diff = acos(n1.x*n2.x + n1.y*n2.y),
          sign = (acos(n1.x*n2p.x + n1.y*n2p.y) < p2 ? 1 : -1);
    // If the angle between the two normals can be resolved,
    // do so. Otherwise --if it's too big-- leave it be. It'll
    // be in an inside-curve, and thus occluded.
    if(diff>PI/20 && diff<PI/2) {
      prev.points[order-1].rotateOver(prev.points[order], -sign * diff/2);
      prev.update();
      next.points[1].rotateOver(next.points[0], sign * diff/2);
      next.update();
    }
  }

  /**
   * return the approximate 't' that the mouse
   * is near. If no approximate value can be found,
   * return -1, which is an impossible value.
   */
  float over(float mx, float my) {
    float r = (float)(LUT_resolution-1);
    for(int idx=0; idx<LUT_resolution; idx++) {
      if(abs(LUT_x[idx] - mx) < 5 && abs(LUT_y[idx] - my) < 5) {
        return idx/r;
      }
    }
    return -1;
  }

  /**
   * return the point we are over, if we're over a point
   */
  int overPoint(float mx, float my) {
    Point p;
    for(int i=0, last=order+1; i<last; i++) {
      p = points[i];
      if(abs(p.x-mx) < 5 && abs(p.y-my) < 5) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Move a curve point
   */
  void movePoint(int idx, float nx, float ny) {
    Point p = points[idx];
    p.x = nx;
    p.y = ny;
    update();
  }

  /**
   * draw this curve
   */
  void draw() { draw(30); }
  void draw(int c) {
    if(showAdditionals && showControlPoints && showPointPoly) {
      drawControlLines();
    }
    float t=0;
    int nx, ny, ox = draw_x[0], oy = draw_y[0];
    for(int idx=0; idx<LUT_resolution; idx++) {
      stroke(c);
      nx = draw_x[idx];
      ny = draw_y[idx];
      if(nx==ox && ny==oy) continue;
      if(drawConnected) { line(ox,oy,nx,ny); }
      else { point(nx, ny); }
      ox=nx;
      oy=ny;
    }
    if(showAdditionals) {
      drawPoints();
    }
  }

  void drawControlLines() {
    stroke(0,100);
    for(int i=1; i<=order; i++) {
      Point p1 = points[i-1];
      Point p2 = points[i];
      line(p1.x,p1.y,p2.x,p2.y);
    }
  }

  void drawPoints() {
    for(int i=0; i<=order; i++) {
      stroke(0,0,200);
      Point p = points[i];
      if(i==0 || i==order) {
        fill(0,0,255);
        p.draw("p"+(i+1)+": ");
      } else {
        noFill();
        if(showControlPoints) { p.draw("p"+(i+1)+": "); }
      }
    }
  }

  String toString() {
    String ret = "B"+order+": ";
    for(int i=0; i<points.length; i++) {
      ret += points[i].toString();
      if(i<order) ret += ", ";
    }
    return ret;
  }
}

/**
 * a null curve is what you get if you derive beyond what the curve supports.
 */
class NullBezierCurve extends BezierCurve {
  NullBezierCurve() { super(); }
  BezierCurve getDerivative() { return this; }
  float getValue(float t) { return 0; }
}


/***************************************************
 *                                                 *
 *    A generic Poly-Bezier curve implementation   *
 *                                                 *
 ***************************************************/

/**
 * A Poly-Bezier curve class
 */
class PolyBezierCurve {
  int pointCount = -1;
  ArrayList<BezierCurve> segments;
  float length = 0;
  boolean constrained = true,
          closed = false,
          integrate = false;
  int lastStart = 0;

  /**
   * Form a new poly-bezier
   */
  PolyBezierCurve() {
    segments = new ArrayList<BezierCurve>();
  }

  PolyBezierCurve(boolean c) {
    this();
    constrained = c;
  }

  /**
   * Add a segment to this poly-bezier
   */
  void addCurve(BezierCurve curve) {
    addCurve(curve,true);
  }

  void addCurve(BezierCurve curve, boolean integrate) {
    int len = segments.size();
    segments.add(curve);
    if (len==0) { return; }
    BezierCurve pc = segments.get(len-1);
    Point[] points = pc.points;
    int plen = points.length;
    // make the segments share endpoints.
    if (this.integrate || integrate) {
      curve.points[0] = points[plen-1];
    }
    if (constrained) {
      curve.points[1] = points[plen-1].reflect(points[plen-2]);
    }
    curve.update();
    // get order
    if (pointCount==-1) {
      pointCount = plen;
    }
    // administer length
    length += curve.getCurveLength();
    if(this.integrate == false) {
      this.integrate = true;
    }
  }

  /**
   * Close up this poly-Bezier curve
   */
  // FIXME: this does not close subshapes yet, so technically
  //        closed subshapes do not truly shape "start"/"end".
  void close() {
    BezierCurve c0 = segments.get(lastStart);
    BezierCurve cL = segments.get(segments.size()-1);
    cL.points[pointCount-1] = c0.points[0];
    closed = true;
    lastStart = segments.size();
  }

  /**
   * Start a sub-shape
   */
  void subShape() { integrate = false; }

  /**
   * prepend all segments from another curve to this one
   */
  void prepend(PolyBezierCurve c) {
    int pos = 0;
    for(BezierCurve bc: c.segments) {
      segments.add(pos++,bc);
      length += bc.getCurveLength();
    }
  }

  /**
   * append all segments from another curve to this one
   */
  void append(PolyBezierCurve c) {
    for(BezierCurve bc: c.segments) {
      segments.add(bc);
      length += bc.getCurveLength();
    }
  }

  /**
   * get Polycurve length
   */
  float getCurveLength() {
    return length;
  }

  /**
   * Get the first curve segment
   */
  BezierCurve getFirst() {
    return segments.get(0);
  }

  /**
   * Get the first curve segment
   */
  BezierCurve getLast() {
    return segments.get(segments.size()-1);
  }

  /**
   * flip direction for this poly curve
   */
  void flip() {
    ArrayList<BezierCurve> newSegments = new  ArrayList<BezierCurve>();
    BezierCurve c;
    for(int i=segments.size()-1; i>=0; i--) {
      c = segments.get(i);
      c.reverse();
      newSegments.add(c);
    }
    segments = newSegments;
  }

  /**
   * return the approximate 't' that the mouse
   * is near. If no approximate value can be found,
   * return -1, which is an impossible value.
   *
   * Note that for poly-beziers, t can range from 0
   * to n, where n is the number of segments.
   */
  float over(float mx, float my) {
    float t;
    int n = -1;
    for (BezierCurve c: segments) {
      n++;
      t = c.over(mx, my);
      if (t!=-1) {
        return t+n;
      }
    }
    return -1;
  }

  /**
   * return the point we are over, if we're over a point
   */
  int overPoint(float mx, float my) {
    Point p;
    int n = 0;
    for (BezierCurve c: segments) {
      for (int i=0; i<pointCount; i++) {
        p = c.points[i];
        if (abs(p.x-mx) < 5 && abs(p.y-my) < 5) {
          return n+i;
        }
      }
      n += pointCount;
    }
    return -1;
  }

  /**
   * get a point [point] form a segment [segment]
   */
  Point getPoint(int segment, int point) {
    return segments.get(segment).points[point];
  }

  /**
   * Move a curve point without any constraints
   */
  // FIXME: compact with the other two functions
  void movePoint(int idx, float nx, float ny) {
    int n = floor((float)idx/pointCount),
    i = idx%pointCount;
    Point p = getPoint(n, i);
    // get delta
    float dx = nx - p.x,
    dy = ny - p.y;
    p.x = nx;
    p.y = ny;
    segments.get(n).update();
    // update the adjacent section, if we moved an endpoint.
    if (i==0) {
      if(n==0) { getLast().update(); }
      else { segments.get(n-1).update(); }

    }
    if (i==pointCount-1) {
      if(n<segments.size()-1) { segments.get(n+1).update(); }
      else { getFirst().update(); }
    }
  }

  /**
   * Move a curve point; this only preserves the poly-Bezier
   * angular relation, but allows alternative tangental
   * strength. To constrain on derivative value, use the
   * movePointConstrained function, instead.
   */
  // FIXME: compact with the other two functions
  void movePointHalfConstrained(int idx, float nx, float ny) {
    int n = floor((float)idx/pointCount),
    i = idx%pointCount;
    Point p = getPoint(n, i);
    // get delta
    float dx = nx - p.x,
    dy = ny - p.y;
    p.x = nx;
    p.y = ny;
    // update local control point
    Point m;
    if (i==0 && n > 0) {
      m = getPoint(n, 1);
      m.moveBy(dx, dy);
      // also move related control in prev
      m = getPoint(n-1, pointCount-2);
      m.moveBy(dx, dy);
    }
    else if (i==pointCount-1 && n < segments.size()-1) {
      m = getPoint(n, i-1);
      m.moveBy(dx, dy);
      // also move related control in next
      m = getPoint(n+1, 1);
      m.moveBy(dx, dy);
    }
    segments.get(n).update();
    // cascade changes
    if (n>0) {
      updateDown(n-1, false);
    }
    if (n<segments.size()-1) {
      updateUp(n+1, false);
    }
  }

  /**
   * Move a curve point; this preserves the poly-Bezier
   * derivative. To preserve angular relation, but allow
   * alternative tangental strength, use the
   * movePointHalfConstrained function, instead.
   */
  // FIXME: compact with the other two functions
  void movePointConstrained(int idx, float nx, float ny) {
    int n = floor((float)idx/pointCount),
    i = idx%pointCount;
    Point p = getPoint(n, i);
    // get delta
    float dx = nx - p.x,
    dy = ny - p.y;
    p.x = nx;
    p.y = ny;
    // update local control point
    Point m;
    if (i==0 && n > 0) {
      m = getPoint(n, 1);
      m.moveBy(dx, dy);
    }
    else if (i==pointCount-1 && n < segments.size()-1) {
      m = getPoint(n, i-1);
      m.moveBy(dx, dy);
    }
    segments.get(n).update();
    // cascade changes
    if (n>0) {
      updateDown(n-1, true);
    }
    if (n<segments.size()-1) {
      updateUp(n+1, true);
    }
  }

  /**
   * Update all downstream segments. If "full" is
   * true the derivative at the join is maintained.
   * Otherwise the angle is maintained, but the
   * downstream strength is preserved.
   */
  void updateDown(int segment, boolean full) {
    BezierCurve master = segments.get(segment+1),
    current = segments.get(segment);
    Point c = current.points[pointCount-2],
    m = master.points[0],
    reflected = m.reflect(master.points[1]);
    if (full) {
      current.points[pointCount-2] = reflected;
    }
    else {
      float dx, dy, phi1, phi2;
      dx = reflected.x - m.x;
      dy = reflected.y - m.y;
      phi1 = atan2(dy, dx);
      dx = c.x - m.x;
      dy = c.y - m.y;
      phi2 = atan2(dy, dx);
      current.points[pointCount-2].rotateOver(m, phi1-phi2);
    }
    current.update();
    if (segment>0) {
      updateDown(segment-1, full);
    }
  }

  /**
   * Update all upstream segments. If "full" is
   * true the derivative at the join is maintained.
   * Otherwise the angle is maintained, but the
   * upstream strength is preserved.
   */
  void updateUp(int segment, boolean full) {
    BezierCurve master = segments.get(segment-1),
    current = segments.get(segment);
    Point c = current.points[1],
    m = master.points[pointCount-2],
    reflected = current.points[0].reflect(m);
    if (full) {
      current.points[1] = reflected;
    }
    else {
      float dx, dy, phi1, phi2;
      dx = reflected.x - m.x;
      dy = reflected.y - m.y;
      phi1 = atan2(dy, dx);
      dx = c.x - m.x;
      dy = c.y - m.y;
      phi2 = atan2(dy, dx);
      c.rotateOver(m, phi1-phi2);
    }
    current.update();
    if (segment<segments.size()-1) {
      updateUp(segment+1, full);
    }
  }

  /**
   * Find intersections between this poly-bezier and some other poly-bezier.
   */
  ArrayList<CurvePair> getIntersections(PolyBezierCurve other) {
    ArrayList<CurvePair> intersections = new ArrayList<CurvePair>();
    BezierCurve segment;
    for (int i=0; i<segments.size(); i++) {
      segment = segments.get(i);
      // get all curvepairs in which this segment intersects
      // with the other PolyBezierCurve
      ArrayList<CurvePair> cps = other.intersects(segment, i);
      for (CurvePair cp: cps) {
        cp.c1 = segment;
        cp.t1 += i;
        cp.s1 = i;
        intersections.add(cp);
      }
    }
    return intersections;
  }

  /**
   * Find intersections between this poly-bezier and a target single bezier curve.
   */
  ArrayList<CurvePair> intersects(BezierCurve c, int ci) {
    ArrayList<CurvePair> intersections = new ArrayList<CurvePair>(), currentIntersections;
    BezierCurve segment;
    for (int i=0; i<segments.size(); i++) {
      segment = segments.get(i);
      // if there is no bound overlap, don't bother finding intersections.
      if(!c.hasBoundOverlapWith(segment)) continue;
      // get all curvepairs in which these two segments intersect
      currentIntersections = comp.findIntersections(c, segment);
      for (CurvePair cp: currentIntersections) {
        cp.setTValues();
        cp.c2 = segment;
        cp.t2 += i;
        cp.s2 = i;
        intersections.add(cp);
      }
    }
    return intersections;
  }

  /**
   * Split this poly curve between c1's t=t1 and c2's t=t2.
   */
  PolyBezierCurve split(float t1, float t2) {
    int pos1 = (int) t1, pos2 = (int) t2;
    BezierCurve c1 = segments.get(pos1),
    c2 = segments.get(pos2);
    t1 = t1 % 1;
    t2 = t2 % 1;
    PolyBezierCurve newPoly = new PolyBezierCurve(false);
    // subcurve on a single section?
    if (pos1==pos2) {
      newPoly.addCurve(c1.split(t1, t2));
    }
    else {
      // not on a single section... more work =)
      newPoly.addCurve(c1.split(t1)[1]);
      while (++pos1 < pos2) {
        newPoly.addCurve(segments.get(pos1));
      }
      newPoly.addCurve(c2.split(t2)[0]);
    }
    return newPoly;
  }

  /**
   *
   */
  PolyBezierCurve[] split(float t) {
    int pos = (int) t;
    BezierCurve c = segments.get(pos);
    t = t % 1;
    PolyBezierCurve[] newPolies = {
      new PolyBezierCurve(false), new PolyBezierCurve(false)
    };
    int i=0;
    while (i++<pos) {
      newPolies[0].addCurve(segments.get(i));
    }
    BezierCurve[] bcs = segments.get(pos).split(t);
    newPolies[0].addCurve(bcs[0]);
    newPolies[1].addCurve(bcs[1]);
    while (++pos<segments.size ()) {
      newPolies[1].addCurve(segments.get(pos));
    }
    return newPolies;
  }

  /**
   * Does this (closed) curve contain the indicated BezierCurve?
   * PREREQUISITE: the curve must be either fully contained,
   * or fully outside the shape (except for its start and end
   * points, which will lie on the curve outline). This method
   * uses the Even–odd rule for test "insidedness".
   */
  int contains(PolyBezierCurve pbc, Point reference) {
    Point p1, p2 = reference;
    // single curve? The use the curve midpoint
    if(pbc.segments.size()==1) { p1 = pbc.segments.get(0).getPoint(0.5); }
    // poly-bezier? use the first segment-joint
    else { p1 = pbc.segments.get(1).points[0]; }
    // EVEN-ODD-RULE
    return getCrossingNumber(p1, p2);
  }

  // get the crossing number for line p1--p2
  int getCrossingNumber(Point p1, Point p2) {
    float d = dist(p1.x,p1.y,p2.x,p2.y);
    int crossings = 0;
    for (int s=0; s<segments.size(); s++) {
      BezierCurve segment = segments.get(s);
      BezierCurve aligned = segment.align(p1,p2);
      float[] roots = comp.findAllRoots(0, aligned.y_values);
      // at this point the roots do not take the line
      // start and end points into account; verify:
      for(float r: roots) {
        // remember, we don't care about end points, so <= and >=
        if(r<=0 || r>=1) continue;
        Point m = aligned.getPoint(r);
        if(abs(m.y)>1 || m.x>0 || m.x < -d) continue;
        crossings++;
      }
    }
    // done
    return crossings;
  }

  /**
   * draw this poly-Bezier
   */
  void draw() {
    for (BezierCurve c: segments) {
      c.draw();
    }
  }
  void draw(color col) {
    for (BezierCurve c: segments) {
      c.draw(col);
    }
  }
  void draw(color col, boolean colorify) {
    int i = 0;
    for (BezierCurve c: segments) {
      c.draw(colorListing[i++]);
    }
  }
}


/**
 * CurvePairs are linked curves for finding intersections.
 * Without linking specific pairs, it's very easy to write
 * a bad algorithm.
 */
class CurvePair {
  boolean overlapping = false;
  BezierCurve c1, c2;
  float t1, t2;
  int s1, s2;

  CurvePair(BezierCurve _c1, BezierCurve _c2) {
    c1 = _c1;
    c2 = _c2;
    overlapping = c1.hasBoundOverlapWith(c2);
  }

  // Is this pair an overlapping pair?
  boolean hasOverlap() {
    return overlapping;
  }

  // Split up this pair into two subcurves for
  // each pair, and permute-combine.
  CurvePair[] splitAndCombine() {
    CurvePair[] sc = new CurvePair[4];
    BezierCurve[] c1s = c1.split();
    BezierCurve[] c2s = c2.split();
    sc[0] = new CurvePair(c1s[0], c2s[0]);
    sc[1] = new CurvePair(c1s[1], c2s[0]);
    sc[2] = new CurvePair(c1s[0], c2s[1]);
    sc[3] = new CurvePair(c1s[1], c2s[1]);
    return sc;
  }

  /**
   *
   */
  void setTValues() {
    float[] t1s = c1.getInterval(),
            t2s = c2.getInterval();
    t1 = (t1s[0] + t1s[1])/2;
    t2 = (t2s[0] + t2s[1])/2;
  }

  // Is this pair small enough to count as "done"?
  boolean smallEnough() {
    return c1.getCurveLength() < 0.5 && c2.getCurveLength() < 0.5;
  }

  // draw these curves with linked coloring
  void draw(color c) { c1.draw(c); c2.draw(c); }

  // ye olde toStringe
  String toString() { return c1  + " -- " + c2; }
}


/***************************************************
 *                                                 *
 * A special computer class for generic operations *
 *                                                 *
 ***************************************************/

/**
 * static computation class
 */
class BezierComputer {
  // LUT for how many de Casteljau's interpolation markers are required.
  private int[] marks = {0};

  // Look up how many markers are there in de Casteljau's span for order ...?
  private int markers(int n) {
    if(n>marks.length-1) {
      marks = new int[2*n];
      for(int i=0, v=0; i<marks.length; i++) {
        v += i;
        marks[i] = v;
      }
    }
    return marks[n];
  }

  // LUT for binomial coefficient arrays per curve order 'n'
  private float[][] binomial_coefficients = {{1},{1,1}};

  // Look up what the binomial coefficient is for pair {n,k}
  private float binomials(int n, int k) {
    while(n >= binomial_coefficients.length) {
      int s = binomial_coefficients.length;
      float[][] update_coefficients = new float[s+1][];
      arrayCopy(binomial_coefficients,0,update_coefficients,0,s);
      float[] current = binomial_coefficients[s-1];
      float[] next = new float[s+1];
      update_coefficients[s] = next;
      // fill in "next" row
      next[0] = 1;
      for(int i=1; i<current.length; i++) {
        next[i] = current[i] + current[i-1];
      }
      next[s] = 1;
      // swap
      binomial_coefficients = update_coefficients;
    }
    return binomial_coefficients[n][k];
  }

  // compute a polynomial term {n,k} at t
  private float polyterm(int n, int k, float t) {
    return pow((1-t),n-k) * pow(t,k);
  }

  /**
   * Compute the curve value at t
   */
  float getValue(float t, float[] v) {
    int order = v.length-1;
    float value = 0;
    for(int n=order, k=0; k<=n; k++) {
      if(v[k]==0) continue;
      value += binomials(n,k) * polyterm(n,k,t) * v[k];
    }
    return value;
  }

  /**
   * Compute the curve derivative (hodograph) at t.
   */
  float getDerivative(int derivative, float t, float[] v) {
    // the derivative of any 't'-less function is zero.
    int n = v.length-1;
    if(n==0) { return 0; }

    // direct values? compute!
    if(derivative==0) {
      float value = 0;
      for(int k=0; k<=n; k++) {
        value += binomials(n,k) * pow(1-t,n-k) * pow(t,k) * v[k];
      }
      return value;
    }
    // Still some derivative? go down one order, then try
    // for the lower order curve's.
    else {
      float[] _v = new float[v.length-1];
      for(int k=0; k<_v.length; k++) {
        _v[k] = n * (v[k+1] - v[k]);
      }
      return getDerivative(derivative-1, t, _v);
    }
  }

  /**
   * quadratic (A-B):(B-C) ratio function
   * NOTE: this function only generates a meaningful
   *       result for 2nd and 3rd order curves. For
   *       anything else it'll throw an error.
   */
  float calculateProjectionRatio(float t, int order) throws NoRatioExistsException {
    float tn, mtn, n, d;
    if(order==2) {
      tn = 2*pow(t,2);
      mtn = 2*t;
      n = tn - mtn;
      d = n + 1;
    } else if (order == 3) {
      tn = pow(t,3);
      mtn = pow(1-t,3);
      d = tn + mtn;
      n = d - 1;
    } else { throw new NoRatioExistsException(order); }
    return abs(d/n);
  }

  /**
   * Generate a 2nd or 3rd order Bezier curve from three points.
   * NOTE: the 't' value for the midpoint is optional.
   */
  BezierCurve generateCurve(int order, Point p1, Point p2, Point p3) {
    return generateCurve(order, p1, p2, p3, 0.5);
  }

  BezierCurve generateCurve(int order, Point p1, Point p2, Point p3, float t) {
    Point tangent = new Point((p1.x-p3.x)/((order-1)*2), (p1.y-p3.y)/((order-1)*2));
    Point[] tangents = {tangent, tangent.scale(-1)};
    return generateCurve(order, p1, p2, p3, t, tangents);
  }

  BezierCurve generateCurve(int order, Point p1, Point p2, Point p3, float t, Point[] tangents) {
    Point[] points = (order==2? new Point[]{p1,p2,p3} : new Point[]{p1,p2,p2,p3});
    BezierCurve curve = new BezierCurve(points);
    points = curve.points;
    float ratio = calculateProjectionRatio(t, order);
    Point[] span = curve.generateSpan(t);
    Point[] ds = curve.getABC(t);
    if(order==2) { points[1] = new Point(p2.x - ratio*(ds[2].x-p2.x), p2.y - ratio*(ds[2].y-p2.y)); }
    else if(order==3) {
      Point helper = new Point(p2.x - ratio*(ds[2].x-p2.x), p2.y - ratio*(ds[2].y-p2.y));
      Point[] controls = getCubicControls(helper,p2,t,span,tangents);
      points[1] = controls[0];
      points[2] = controls[1];
    } else { return null; }
    curve.update();
    return curve;
  }

  // construct sensible 3rd order control points when generating a cubic curve off of three points.
  private Point[] getCubicControls(Point NA, Point NB, float t, Point[] span, Point[] tangents) {
    float mt = 1-t, dx = tangents[0].x, dy = tangents[0].y;
    Point new7 = new Point(NB.x + dx, NB.y + dy);
    dx = -tangents[1].x;
    dy = -tangents[1].y;
    Point new8 = new Point(NB.x - dx, NB.y - dy);
    // reverse De Casteljau
    dx = t * (new7.x - NA.x) / mt;
    dy = t * (new7.y - NA.y) / mt;
    Point new4 = new Point(new7.x + dx, new7.y + dy);
    dx = mt * (new8.x - NA.x) / t;
    dy = mt * (new8.y - NA.y) / t;
    Point new6 = new Point(new8.x + dx, new8.y + dy);
    // reverse De Casteljau for the new control points
    dx = mt * (new4.x - span[0].x) / t;
    dy = mt * (new4.y - span[0].y) / t;
    Point c1 = new Point(new4.x + dx, new4.y + dy);
    dx = t * (new6.x - span[3].x) / mt;
    dy = t * (new6.y - span[3].y) / mt;
    Point c2 = new Point(new6.x + dx, new6.y + dy);
    return new Point[]{c1, c2};
  }

  /**
   * Arc length computation, using the Legendre-Guass quadrature approach.
   * If no length can be computed due to a lack of T/C values, return -1
   * to signify "I cannot compute this value for you".
   */
  float getArcLength(float[] x_values, float[] y_values) { return getArcLength(1, x_values, y_values); }
  float getArcLength(float t, float[] x_values, float[] y_values) { return getArcLength(t, 24, x_values, y_values); }
  float getArcLength(float t, int n, float[] x_values, float[] y_values) {
    if(x_values.length-1 >= Tvalues.length) return -1; // errp
    float z = t/2;
    float sum = 0;
    for(int i=0; i<n; i++) {
      float corrected_t = z * Tvalues[n][i] + z;
      sum += Cvalues[n][i] * B(corrected_t, x_values, y_values);
    }
    return z * sum;
  }

  // LGQ function for Bezier curve arc length
  private float B(float t, float[] x_values, float[] y_values) {
    float xbase = comp.getDerivative(1,t,x_values);
    float ybase = comp.getDerivative(1,t,y_values);
    float combined = xbase*xbase + ybase*ybase;
    return sqrt(combined);
  }

  // Legendre-Gauss abscissae (xi values, defined at i=n as the roots of the nth order Legendre polynomial Pn(x))
  private float[][] Tvalues = {{},{},
    {  -0.5773502691896257645091487805019574556476,0.5773502691896257645091487805019574556476},
    {0,-0.7745966692414833770358530799564799221665,0.7745966692414833770358530799564799221665},
    {  -0.3399810435848562648026657591032446872005,0.3399810435848562648026657591032446872005,-0.8611363115940525752239464888928095050957,0.8611363115940525752239464888928095050957},
    {0,-0.5384693101056830910363144207002088049672,0.5384693101056830910363144207002088049672,-0.9061798459386639927976268782993929651256,0.9061798459386639927976268782993929651256},
    {   0.6612093864662645136613995950199053470064,-0.6612093864662645136613995950199053470064,-0.2386191860831969086305017216807119354186,0.2386191860831969086305017216807119354186,-0.9324695142031520278123015544939946091347,0.9324695142031520278123015544939946091347},
    {0, 0.4058451513773971669066064120769614633473,-0.4058451513773971669066064120769614633473,-0.7415311855993944398638647732807884070741,0.7415311855993944398638647732807884070741,-0.9491079123427585245261896840478512624007,0.9491079123427585245261896840478512624007},
    {  -0.1834346424956498049394761423601839806667,0.1834346424956498049394761423601839806667,-0.5255324099163289858177390491892463490419,0.5255324099163289858177390491892463490419,-0.7966664774136267395915539364758304368371,0.7966664774136267395915539364758304368371,-0.9602898564975362316835608685694729904282,0.9602898564975362316835608685694729904282},
    {0,-0.8360311073266357942994297880697348765441,0.8360311073266357942994297880697348765441,-0.9681602395076260898355762029036728700494,0.9681602395076260898355762029036728700494,-0.3242534234038089290385380146433366085719,0.3242534234038089290385380146433366085719,-0.6133714327005903973087020393414741847857,0.6133714327005903973087020393414741847857},
    {  -0.1488743389816312108848260011297199846175,0.1488743389816312108848260011297199846175,-0.4333953941292471907992659431657841622000,0.4333953941292471907992659431657841622000,-0.6794095682990244062343273651148735757692,0.6794095682990244062343273651148735757692,-0.8650633666889845107320966884234930485275,0.8650633666889845107320966884234930485275,-0.9739065285171717200779640120844520534282,0.9739065285171717200779640120844520534282},
    {0,-0.2695431559523449723315319854008615246796,0.2695431559523449723315319854008615246796,-0.5190961292068118159257256694586095544802,0.5190961292068118159257256694586095544802,-0.7301520055740493240934162520311534580496,0.7301520055740493240934162520311534580496,-0.8870625997680952990751577693039272666316,0.8870625997680952990751577693039272666316,-0.9782286581460569928039380011228573907714,0.9782286581460569928039380011228573907714},
    {  -0.1252334085114689154724413694638531299833,0.1252334085114689154724413694638531299833,-0.3678314989981801937526915366437175612563,0.3678314989981801937526915366437175612563,-0.5873179542866174472967024189405342803690,0.5873179542866174472967024189405342803690,-0.7699026741943046870368938332128180759849,0.7699026741943046870368938332128180759849,-0.9041172563704748566784658661190961925375,0.9041172563704748566784658661190961925375,-0.9815606342467192506905490901492808229601,0.9815606342467192506905490901492808229601},
    {0,-0.2304583159551347940655281210979888352115,0.2304583159551347940655281210979888352115,-0.4484927510364468528779128521276398678019,0.4484927510364468528779128521276398678019,-0.6423493394403402206439846069955156500716,0.6423493394403402206439846069955156500716,-0.8015780907333099127942064895828598903056,0.8015780907333099127942064895828598903056,-0.9175983992229779652065478365007195123904,0.9175983992229779652065478365007195123904,-0.9841830547185881494728294488071096110649,0.9841830547185881494728294488071096110649},
    {  -0.1080549487073436620662446502198347476119,0.1080549487073436620662446502198347476119,-0.3191123689278897604356718241684754668342,0.3191123689278897604356718241684754668342,-0.5152486363581540919652907185511886623088,0.5152486363581540919652907185511886623088,-0.6872929048116854701480198030193341375384,0.6872929048116854701480198030193341375384,-0.8272013150697649931897947426503949610397,0.8272013150697649931897947426503949610397,-0.9284348836635735173363911393778742644770,0.9284348836635735173363911393778742644770,-0.9862838086968123388415972667040528016760,0.9862838086968123388415972667040528016760},
    {0,-0.2011940939974345223006283033945962078128,0.2011940939974345223006283033945962078128,-0.3941513470775633698972073709810454683627,0.3941513470775633698972073709810454683627,-0.5709721726085388475372267372539106412383,0.5709721726085388475372267372539106412383,-0.7244177313601700474161860546139380096308,0.7244177313601700474161860546139380096308,-0.8482065834104272162006483207742168513662,0.8482065834104272162006483207742168513662,-0.9372733924007059043077589477102094712439,0.9372733924007059043077589477102094712439,-0.9879925180204854284895657185866125811469,0.9879925180204854284895657185866125811469},
    {  -0.0950125098376374401853193354249580631303,0.0950125098376374401853193354249580631303,-0.2816035507792589132304605014604961064860,0.2816035507792589132304605014604961064860,-0.4580167776572273863424194429835775735400,0.4580167776572273863424194429835775735400,-0.6178762444026437484466717640487910189918,0.6178762444026437484466717640487910189918,-0.7554044083550030338951011948474422683538,0.7554044083550030338951011948474422683538,-0.8656312023878317438804678977123931323873,0.8656312023878317438804678977123931323873,-0.9445750230732325760779884155346083450911,0.9445750230732325760779884155346083450911,-0.9894009349916499325961541734503326274262,0.9894009349916499325961541734503326274262},
    {0,-0.1784841814958478558506774936540655574754,0.1784841814958478558506774936540655574754,-0.3512317634538763152971855170953460050405,0.3512317634538763152971855170953460050405,-0.5126905370864769678862465686295518745829,0.5126905370864769678862465686295518745829,-0.6576711592166907658503022166430023351478,0.6576711592166907658503022166430023351478,-0.7815140038968014069252300555204760502239,0.7815140038968014069252300555204760502239,-0.8802391537269859021229556944881556926234,0.8802391537269859021229556944881556926234,-0.9506755217687677612227169578958030214433,0.9506755217687677612227169578958030214433,-0.9905754753144173356754340199406652765077,0.9905754753144173356754340199406652765077},
    {  -0.0847750130417353012422618529357838117333,0.0847750130417353012422618529357838117333,-0.2518862256915055095889728548779112301628,0.2518862256915055095889728548779112301628,-0.4117511614628426460359317938330516370789,0.4117511614628426460359317938330516370789,-0.5597708310739475346078715485253291369276,0.5597708310739475346078715485253291369276,-0.6916870430603532078748910812888483894522,0.6916870430603532078748910812888483894522,-0.8037049589725231156824174550145907971032,0.8037049589725231156824174550145907971032,-0.8926024664975557392060605911271455154078,0.8926024664975557392060605911271455154078,-0.9558239495713977551811958929297763099728,0.9558239495713977551811958929297763099728,-0.9915651684209309467300160047061507702525,0.9915651684209309467300160047061507702525},
    {0,-0.1603586456402253758680961157407435495048,0.1603586456402253758680961157407435495048,-0.3165640999636298319901173288498449178922,0.3165640999636298319901173288498449178922,-0.4645707413759609457172671481041023679762,0.4645707413759609457172671481041023679762,-0.6005453046616810234696381649462392798683,0.6005453046616810234696381649462392798683,-0.7209661773352293786170958608237816296571,0.7209661773352293786170958608237816296571,-0.8227146565371428249789224867127139017745,0.8227146565371428249789224867127139017745,-0.9031559036148179016426609285323124878093,0.9031559036148179016426609285323124878093,-0.9602081521348300308527788406876515266150,0.9602081521348300308527788406876515266150,-0.9924068438435844031890176702532604935893,0.9924068438435844031890176702532604935893},
    {  -0.0765265211334973337546404093988382110047,0.0765265211334973337546404093988382110047,-0.2277858511416450780804961953685746247430,0.2277858511416450780804961953685746247430,-0.3737060887154195606725481770249272373957,0.3737060887154195606725481770249272373957,-0.5108670019508270980043640509552509984254,0.5108670019508270980043640509552509984254,-0.6360536807265150254528366962262859367433,0.6360536807265150254528366962262859367433,-0.7463319064601507926143050703556415903107,0.7463319064601507926143050703556415903107,-0.8391169718222188233945290617015206853296,0.8391169718222188233945290617015206853296,-0.9122344282513259058677524412032981130491,0.9122344282513259058677524412032981130491,-0.9639719272779137912676661311972772219120,0.9639719272779137912676661311972772219120,-0.9931285991850949247861223884713202782226,0.9931285991850949247861223884713202782226},
    {0,-0.1455618541608950909370309823386863301163,0.1455618541608950909370309823386863301163,-0.2880213168024010966007925160646003199090,0.2880213168024010966007925160646003199090,-0.4243421202074387835736688885437880520964,0.4243421202074387835736688885437880520964,-0.5516188358872198070590187967243132866220,0.5516188358872198070590187967243132866220,-0.6671388041974123193059666699903391625970,0.6671388041974123193059666699903391625970,-0.7684399634756779086158778513062280348209,0.7684399634756779086158778513062280348209,-0.8533633645833172836472506385875676702761,0.8533633645833172836472506385875676702761,-0.9200993341504008287901871337149688941591,0.9200993341504008287901871337149688941591,-0.9672268385663062943166222149076951614246,0.9672268385663062943166222149076951614246,-0.9937521706203895002602420359379409291933,0.9937521706203895002602420359379409291933},
    {  -0.0697392733197222212138417961186280818222,0.0697392733197222212138417961186280818222,-0.2078604266882212854788465339195457342156,0.2078604266882212854788465339195457342156,-0.3419358208920842251581474204273796195591,0.3419358208920842251581474204273796195591,-0.4693558379867570264063307109664063460953,0.4693558379867570264063307109664063460953,-0.5876404035069115929588769276386473488776,0.5876404035069115929588769276386473488776,-0.6944872631866827800506898357622567712673,0.6944872631866827800506898357622567712673,-0.7878168059792081620042779554083515213881,0.7878168059792081620042779554083515213881,-0.8658125777203001365364256370193787290847,0.8658125777203001365364256370193787290847,-0.9269567721871740005206929392590531966353,0.9269567721871740005206929392590531966353,-0.9700604978354287271239509867652687108059,0.9700604978354287271239509867652687108059,-0.9942945854823992920730314211612989803930,0.9942945854823992920730314211612989803930},
    {0,-0.1332568242984661109317426822417661370104,0.1332568242984661109317426822417661370104,-0.2641356809703449305338695382833096029790,0.2641356809703449305338695382833096029790,-0.3903010380302908314214888728806054585780,0.3903010380302908314214888728806054585780,-0.5095014778460075496897930478668464305448,0.5095014778460075496897930478668464305448,-0.6196098757636461563850973116495956533871,0.6196098757636461563850973116495956533871,-0.7186613631319501944616244837486188483299,0.7186613631319501944616244837486188483299,-0.8048884016188398921511184069967785579414,0.8048884016188398921511184069967785579414,-0.8767523582704416673781568859341456716389,0.8767523582704416673781568859341456716389,-0.9329710868260161023491969890384229782357,0.9329710868260161023491969890384229782357,-0.9725424712181152319560240768207773751816,0.9725424712181152319560240768207773751816,-0.9947693349975521235239257154455743605736,0.9947693349975521235239257154455743605736},
    {  -0.0640568928626056260850430826247450385909,0.0640568928626056260850430826247450385909,-0.1911188674736163091586398207570696318404,0.1911188674736163091586398207570696318404,-0.3150426796961633743867932913198102407864,0.3150426796961633743867932913198102407864,-0.4337935076260451384870842319133497124524,0.4337935076260451384870842319133497124524,-0.5454214713888395356583756172183723700107,0.5454214713888395356583756172183723700107,-0.6480936519369755692524957869107476266696,0.6480936519369755692524957869107476266696,-0.7401241915785543642438281030999784255232,0.7401241915785543642438281030999784255232,-0.8200019859739029219539498726697452080761,0.8200019859739029219539498726697452080761,-0.8864155270044010342131543419821967550873,0.8864155270044010342131543419821967550873,-0.9382745520027327585236490017087214496548,0.9382745520027327585236490017087214496548,-0.9747285559713094981983919930081690617411,0.9747285559713094981983919930081690617411,-0.9951872199970213601799974097007368118745,0.9951872199970213601799974097007368118745}
  };

  // Legendre-Gauss weights (wi values, defined by a function linked to in the Bezier primer article)
  private float[][] Cvalues = {{},{},
    {1.0,1.0},
    {0.8888888888888888888888888888888888888888,0.5555555555555555555555555555555555555555,0.5555555555555555555555555555555555555555},
    {0.6521451548625461426269360507780005927646,0.6521451548625461426269360507780005927646,0.3478548451374538573730639492219994072353,0.3478548451374538573730639492219994072353},
    {0.5688888888888888888888888888888888888888,0.4786286704993664680412915148356381929122,0.4786286704993664680412915148356381929122,0.2369268850561890875142640407199173626432,0.2369268850561890875142640407199173626432},
    {0.3607615730481386075698335138377161116615,0.3607615730481386075698335138377161116615,0.4679139345726910473898703439895509948116,0.4679139345726910473898703439895509948116,0.1713244923791703450402961421727328935268,0.1713244923791703450402961421727328935268},
    {0.4179591836734693877551020408163265306122,0.3818300505051189449503697754889751338783,0.3818300505051189449503697754889751338783,0.2797053914892766679014677714237795824869,0.2797053914892766679014677714237795824869,0.1294849661688696932706114326790820183285,0.1294849661688696932706114326790820183285},
    {0.3626837833783619829651504492771956121941,0.3626837833783619829651504492771956121941,0.3137066458778872873379622019866013132603,0.3137066458778872873379622019866013132603,0.2223810344533744705443559944262408844301,0.2223810344533744705443559944262408844301,0.1012285362903762591525313543099621901153,0.1012285362903762591525313543099621901153},
    {0.3302393550012597631645250692869740488788,0.1806481606948574040584720312429128095143,0.1806481606948574040584720312429128095143,0.0812743883615744119718921581105236506756,0.0812743883615744119718921581105236506756,0.3123470770400028400686304065844436655987,0.3123470770400028400686304065844436655987,0.2606106964029354623187428694186328497718,0.2606106964029354623187428694186328497718},
    {0.2955242247147528701738929946513383294210,0.2955242247147528701738929946513383294210,0.2692667193099963550912269215694693528597,0.2692667193099963550912269215694693528597,0.2190863625159820439955349342281631924587,0.2190863625159820439955349342281631924587,0.1494513491505805931457763396576973324025,0.1494513491505805931457763396576973324025,0.0666713443086881375935688098933317928578,0.0666713443086881375935688098933317928578},
    {0.2729250867779006307144835283363421891560,0.2628045445102466621806888698905091953727,0.2628045445102466621806888698905091953727,0.2331937645919904799185237048431751394317,0.2331937645919904799185237048431751394317,0.1862902109277342514260976414316558916912,0.1862902109277342514260976414316558916912,0.1255803694649046246346942992239401001976,0.1255803694649046246346942992239401001976,0.0556685671161736664827537204425485787285,0.0556685671161736664827537204425485787285},
    {0.2491470458134027850005624360429512108304,0.2491470458134027850005624360429512108304,0.2334925365383548087608498989248780562594,0.2334925365383548087608498989248780562594,0.2031674267230659217490644558097983765065,0.2031674267230659217490644558097983765065,0.1600783285433462263346525295433590718720,0.1600783285433462263346525295433590718720,0.1069393259953184309602547181939962242145,0.1069393259953184309602547181939962242145,0.0471753363865118271946159614850170603170,0.0471753363865118271946159614850170603170},
    {0.2325515532308739101945895152688359481566,0.2262831802628972384120901860397766184347,0.2262831802628972384120901860397766184347,0.2078160475368885023125232193060527633865,0.2078160475368885023125232193060527633865,0.1781459807619457382800466919960979955128,0.1781459807619457382800466919960979955128,0.1388735102197872384636017768688714676218,0.1388735102197872384636017768688714676218,0.0921214998377284479144217759537971209236,0.0921214998377284479144217759537971209236,0.0404840047653158795200215922009860600419,0.0404840047653158795200215922009860600419},
    {0.2152638534631577901958764433162600352749,0.2152638534631577901958764433162600352749,0.2051984637212956039659240656612180557103,0.2051984637212956039659240656612180557103,0.1855383974779378137417165901251570362489,0.1855383974779378137417165901251570362489,0.1572031671581935345696019386238421566056,0.1572031671581935345696019386238421566056,0.1215185706879031846894148090724766259566,0.1215185706879031846894148090724766259566,0.0801580871597602098056332770628543095836,0.0801580871597602098056332770628543095836,0.0351194603317518630318328761381917806197,0.0351194603317518630318328761381917806197},
    {0.2025782419255612728806201999675193148386,0.1984314853271115764561183264438393248186,0.1984314853271115764561183264438393248186,0.1861610000155622110268005618664228245062,0.1861610000155622110268005618664228245062,0.1662692058169939335532008604812088111309,0.1662692058169939335532008604812088111309,0.1395706779261543144478047945110283225208,0.1395706779261543144478047945110283225208,0.1071592204671719350118695466858693034155,0.1071592204671719350118695466858693034155,0.0703660474881081247092674164506673384667,0.0703660474881081247092674164506673384667,0.0307532419961172683546283935772044177217,0.0307532419961172683546283935772044177217},
    {0.1894506104550684962853967232082831051469,0.1894506104550684962853967232082831051469,0.1826034150449235888667636679692199393835,0.1826034150449235888667636679692199393835,0.1691565193950025381893120790303599622116,0.1691565193950025381893120790303599622116,0.1495959888165767320815017305474785489704,0.1495959888165767320815017305474785489704,0.1246289712555338720524762821920164201448,0.1246289712555338720524762821920164201448,0.0951585116824927848099251076022462263552,0.0951585116824927848099251076022462263552,0.0622535239386478928628438369943776942749,0.0622535239386478928628438369943776942749,0.0271524594117540948517805724560181035122,0.0271524594117540948517805724560181035122},
    {0.1794464703562065254582656442618856214487,0.1765627053669926463252709901131972391509,0.1765627053669926463252709901131972391509,0.1680041021564500445099706637883231550211,0.1680041021564500445099706637883231550211,0.1540457610768102880814315948019586119404,0.1540457610768102880814315948019586119404,0.1351363684685254732863199817023501973721,0.1351363684685254732863199817023501973721,0.1118838471934039710947883856263559267358,0.1118838471934039710947883856263559267358,0.0850361483171791808835353701910620738504,0.0850361483171791808835353701910620738504,0.0554595293739872011294401653582446605128,0.0554595293739872011294401653582446605128,0.0241483028685479319601100262875653246916,0.0241483028685479319601100262875653246916},
    {0.1691423829631435918406564701349866103341,0.1691423829631435918406564701349866103341,0.1642764837458327229860537764659275904123,0.1642764837458327229860537764659275904123,0.1546846751262652449254180038363747721932,0.1546846751262652449254180038363747721932,0.1406429146706506512047313037519472280955,0.1406429146706506512047313037519472280955,0.1225552067114784601845191268002015552281,0.1225552067114784601845191268002015552281,0.1009420441062871655628139849248346070628,0.1009420441062871655628139849248346070628,0.0764257302548890565291296776166365256053,0.0764257302548890565291296776166365256053,0.0497145488949697964533349462026386416808,0.0497145488949697964533349462026386416808,0.0216160135264833103133427102664524693876,0.0216160135264833103133427102664524693876},
    {0.1610544498487836959791636253209167350399,0.1589688433939543476499564394650472016787,0.1589688433939543476499564394650472016787,0.1527660420658596667788554008976629984610,0.1527660420658596667788554008976629984610,0.1426067021736066117757461094419029724756,0.1426067021736066117757461094419029724756,0.1287539625393362276755157848568771170558,0.1287539625393362276755157848568771170558,0.1115666455473339947160239016817659974813,0.1115666455473339947160239016817659974813,0.0914900216224499994644620941238396526609,0.0914900216224499994644620941238396526609,0.0690445427376412265807082580060130449618,0.0690445427376412265807082580060130449618,0.0448142267656996003328381574019942119517,0.0448142267656996003328381574019942119517,0.0194617882297264770363120414644384357529,0.0194617882297264770363120414644384357529},
    {0.1527533871307258506980843319550975934919,0.1527533871307258506980843319550975934919,0.1491729864726037467878287370019694366926,0.1491729864726037467878287370019694366926,0.1420961093183820513292983250671649330345,0.1420961093183820513292983250671649330345,0.1316886384491766268984944997481631349161,0.1316886384491766268984944997481631349161,0.1181945319615184173123773777113822870050,0.1181945319615184173123773777113822870050,0.1019301198172404350367501354803498761666,0.1019301198172404350367501354803498761666,0.0832767415767047487247581432220462061001,0.0832767415767047487247581432220462061001,0.0626720483341090635695065351870416063516,0.0626720483341090635695065351870416063516,0.0406014298003869413310399522749321098790,0.0406014298003869413310399522749321098790,0.0176140071391521183118619623518528163621,0.0176140071391521183118619623518528163621},
    {0.1460811336496904271919851476833711882448,0.1445244039899700590638271665537525436099,0.1445244039899700590638271665537525436099,0.1398873947910731547221334238675831108927,0.1398873947910731547221334238675831108927,0.1322689386333374617810525744967756043290,0.1322689386333374617810525744967756043290,0.1218314160537285341953671771257335983563,0.1218314160537285341953671771257335983563,0.1087972991671483776634745780701056420336,0.1087972991671483776634745780701056420336,0.0934444234560338615532897411139320884835,0.0934444234560338615532897411139320884835,0.0761001136283793020170516533001831792261,0.0761001136283793020170516533001831792261,0.0571344254268572082836358264724479574912,0.0571344254268572082836358264724479574912,0.0369537897708524937999506682993296661889,0.0369537897708524937999506682993296661889,0.0160172282577743333242246168584710152658,0.0160172282577743333242246168584710152658},
    {0.1392518728556319933754102483418099578739,0.1392518728556319933754102483418099578739,0.1365414983460151713525738312315173965863,0.1365414983460151713525738312315173965863,0.1311735047870623707329649925303074458757,0.1311735047870623707329649925303074458757,0.1232523768105124242855609861548144719594,0.1232523768105124242855609861548144719594,0.1129322960805392183934006074217843191142,0.1129322960805392183934006074217843191142,0.1004141444428809649320788378305362823508,0.1004141444428809649320788378305362823508,0.0859416062170677274144436813727028661891,0.0859416062170677274144436813727028661891,0.0697964684245204880949614189302176573987,0.0697964684245204880949614189302176573987,0.0522933351526832859403120512732112561121,0.0522933351526832859403120512732112561121,0.0337749015848141547933022468659129013491,0.0337749015848141547933022468659129013491,0.0146279952982722006849910980471854451902,0.0146279952982722006849910980471854451902},
    {0.1336545721861061753514571105458443385831,0.1324620394046966173716424647033169258050,0.1324620394046966173716424647033169258050,0.1289057221880821499785953393997936532597,0.1289057221880821499785953393997936532597,0.1230490843067295304675784006720096548158,0.1230490843067295304675784006720096548158,0.1149966402224113649416435129339613014914,0.1149966402224113649416435129339613014914,0.1048920914645414100740861850147438548584,0.1048920914645414100740861850147438548584,0.0929157660600351474770186173697646486034,0.0929157660600351474770186173697646486034,0.0792814117767189549228925247420432269137,0.0792814117767189549228925247420432269137,0.0642324214085258521271696151589109980391,0.0642324214085258521271696151589109980391,0.0480376717310846685716410716320339965612,0.0480376717310846685716410716320339965612,0.0309880058569794443106942196418845053837,0.0309880058569794443106942196418845053837,0.0134118594871417720813094934586150649766,0.0134118594871417720813094934586150649766},
    {0.1279381953467521569740561652246953718517,0.1279381953467521569740561652246953718517,0.1258374563468282961213753825111836887264,0.1258374563468282961213753825111836887264,0.1216704729278033912044631534762624256070,0.1216704729278033912044631534762624256070,0.1155056680537256013533444839067835598622,0.1155056680537256013533444839067835598622,0.1074442701159656347825773424466062227946,0.1074442701159656347825773424466062227946,0.0976186521041138882698806644642471544279,0.0976186521041138882698806644642471544279,0.0861901615319532759171852029837426671850,0.0861901615319532759171852029837426671850,0.0733464814110803057340336152531165181193,0.0733464814110803057340336152531165181193,0.0592985849154367807463677585001085845412,0.0592985849154367807463677585001085845412,0.0442774388174198061686027482113382288593,0.0442774388174198061686027482113382288593,0.0285313886289336631813078159518782864491,0.0285313886289336631813078159518782864491,0.0123412297999871995468056670700372915759,0.0123412297999871995468056670700372915759}
  };

  // root finding precision cap
  private float NRRF_PRECISION = 0.000001;

  /**
   * Do the curve's weights line up?
   * (note: we assume 2 or more values)
   */
  private boolean areLinear(float[] values) {
    float dx = values[1]-values[0], rx;
    for(int i=2; i<values.length; i++) {
      rx = values[i]-values[i-1];
      if(abs(dx-rx)>2) return false;
    }
    return true;
  }

  /**
   * Root finding using the Newton-Raphson method
   */
  float[] findAllRoots(int derivative, float[] values) {
    float[] none = new float[0];

    // Derivative will be a point function. No roots.
    if(values.length-derivative <=1) {
      return none;
    }

    // Derivative will be a linear function: compute root directly.
    if(values.length-derivative == 2) {
      while(values.length > 2) {
        float[] _v = new float[values.length-1];
        for(int k=0, n=_v.length; k<n; k++) {
          _v[k] = n * (values[k+1] - values[k]);
        }
        values = _v;
      }
      if(values.length<2) {
        return none;
      }
      float root = map(0,values[0],values[1],0,1);
      if(root<0 || root>1) {
        return none;
      }
      return new float[]{root};
    }

    ArrayList<Float> roots = new ArrayList<Float>();
    float root;
    for(float t=0; t<=1.0; t+= 0.01) {
      try {
        root = round(findRoots(derivative, t, values)/NRRF_PRECISION) * NRRF_PRECISION;
        if(root<0 || root>1) continue;
        if(abs(root-t)<=NRRF_PRECISION) continue;
        if(roots.contains(root)) continue;
        roots.add(root);
      } catch (RuntimeException _e) {
        // We don't actually care about this error,
        // it simply indicates no satisfactory root
        // could be found at this 't' value.
      }
    }
    float[] ret = new float[roots.size()];
    for(int i=0, l=ret.length; i<l; i++) {
      ret[i] = roots.get(i);
    }
    return ret;
  }

  float findRoots(int derivative, float t, float[] values) { return findRoots(derivative, t, values, 0); }
  float findRoots(int derivative, float t, float[] values, float offset) { return findRootsRecursive(derivative, t, values, offset, 0); }

  /**
   * Newton-Raphson root finding (with depth capping).
   * Iteratively compute x(n+1) = x(n) - f(x)/f'(x),
   * until (x(n+1) - x(n)) approaches zero with a
   * satisfactory precision.
   */
  float findRootsRecursive(int derivative, float t, float[] values, float offset, float depth) throws RuntimeException {
    // root finding should work.
    float f = getDerivative(derivative, t, values) - offset,
          df = getDerivative(derivative+1, t, values),
          t2 = t - (f/df);

    // division by zero => treat f as unit tangent
    if(df==0) { t2 = t - f; }

    // once we hit the recursion cap, stop
    if(depth > 12) {
      if(abs(t-t2)<NRRF_PRECISION) { return int(t2/NRRF_PRECISION)*NRRF_PRECISION; }
      throw new RuntimeException("Newton-Raphson ran past recursion depth");
    }

    // otherwise, recurse if we've not reached the desired precision yet
    if (abs(t-t2)>NRRF_PRECISION) {
      return findRootsRecursive(derivative, t2, values, offset, depth+1);
    }
    return t2;
  }

  // ========================================================
  //  GENERAL PURPOSE VECTOR ALGEBRA (in non-vector code...)
  // ========================================================

  /**
   * line/line intersection function. Mostly boilerplate.
   */
  private Point lli(Point[] pts) {
    float x1=pts[0].x, y1=pts[0].y,
          x2=pts[1].x, y2=pts[1].y,
          x3=pts[2].x,y3=pts[2].y,
          x4=pts[3].x,y4=pts[3].y,
          nx=(x1*y2-y1*x2)*(x3-x4)-(x1-x2)*(x3*y4-y3*x4),
          ny=(x1*y2-y1*x2)*(y3-y4)-(y1-y2)*(x3*y4-y3*x4),
          d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
    if(d==0) { return null; }
    return new Point(nx/d, ny/d);
  }

  /**
   * Get the projection of X through Y onto the line
   * that passes through A and B.
   */
  Point getProjection(Point X, Point Y, Point A, Point B) {
    return lli(new Point[]{X,Y,A,B});
  }

  /**
   * Get the dot product between two line vectors
   */
  float getDotProduct(Point p1, Point p2, Point p3, Point p4) {
    float dx1 = p2.x - p1.x,
          dy1 = p2.y - p1.y,
          dx2 = p4.x - p3.x,
          dy2 = p4.y - p3.y;
    // and normalise the vectors
    float l1 = sqrt(dx1*dx1 + dy1*dy1),
          l2 = sqrt(dx2*dx2 + dy2*dy2);
    if (l1==0 || l2==0) return 0;
    dx1 /= l1; dy1 /= l1;
    dx2 /= l2; dy2 /= l2;
    return dx1*dx2 + dy1*dy2;
  }

  /**
   * Get the "on the side"dness between a point and
   * a line between s and e.
   */
  float getSide(Point s, Point e, Point p) {
    float dx1 = e.x - s.x,
          dy1 = e.y - s.y,
          dx2 = p.x - s.x,
          dy2 = p.y - s.y;
    // normalise the vectors
    float l1 = sqrt(dx1*dx1 + dy1*dy1),
          l2 = sqrt(dx2*dx2 + dy2*dy2);
    if (l1==0 || l2==0) return 0;
    dx1 /= l1; dy1 /= l1;
    dx2 /= l2; dy2 /= l2;
    // rotate a quarter turn
    float a = PI/2, ca = cos(a), sa = sin(a),
          nx1 = dx1*ca - dy1*sa,
          ny1 = dx1*sa + dy1*ca;
    return (nx1*dx2 + ny1*dy2 < 0 ? -1 : 1);
  }

  /**
   * Perform intersection detection between two curves
   */
  ArrayList<CurvePair> findIntersections(BezierCurve c1, BezierCurve c2) {
    ArrayList<CurvePair> pairs = new ArrayList<CurvePair>();
    ArrayList<CurvePair> finals = new ArrayList<CurvePair>();
    pairs.add(new CurvePair(c1,c2));
    refineIntersections(pairs, finals);
    return finals;
  }

  /**
   * iterative intersection refinement based on curve pairs.
   */
  private void refineIntersections(ArrayList<CurvePair> pairs, ArrayList<CurvePair> finals) {
    if(pairs.size()==0) { return; }
    ArrayList<CurvePair> newPairs = new ArrayList<CurvePair>();
    for(CurvePair cp: pairs) {
      if(cp.hasOverlap()) {
        if(cp.smallEnough()) {
          finals.add(cp);
        }
        else {
          CurvePair[] expanded = cp.splitAndCombine();
          for(CurvePair ncp: expanded) {
            newPairs.add(ncp);
          }
        }
      }
    }
    pairs.clear();
    for(CurvePair cp: newPairs) { pairs.add(cp); }
    refineIntersections(pairs, finals);
  }
}

// exception used in calculateABCRatio when there is no such ratio:
class NoRatioExistsException extends RuntimeException {
  String msg;
  NoRatioExistsException(int order) { msg = "Curve of order "+order+" has no fixed ABC ratio."; }
  String toString() { return msg; }
}


/***************************************************
 *                                                 *
 *  A special computer class for shape operations  *
 *                                                 *
 ***************************************************/

/**
 *  computation class for Boolean shape operations
 */
class BooleanComputer {
  // each instance operates on two shapes.
  PolyBezierCurve p1, p2;

  ArrayList<CurvePair> intersections;
  ArrayList<PolyBezierCurve> segments1, segments2;

  IntersectionTracker intersectionTracker;

  final int UNION = 0,
            INTERSECTION = 1,
            EXCLUSION = 2;

  /**
   * bind poly-beziers and compute segmentation
   */
  BooleanComputer(PolyBezierCurve _p1, PolyBezierCurve _p2) {
    p1 = _p1;
    p2 = _p2;
    segment();
  }

  /**
   * Split up p1 and p2 into lists of continuous sections
   * based on the intersection points.
   */
  void segment() {
    intersections = p1.getIntersections(p2);
    intersectionTracker = new IntersectionTracker(intersections.size());

    if(intersections.size()>0) {
      // make sure the curvepairs are sorted w.r.t. t values on p1
      if(p1.segments.size()>0) {
        int MODE = 1;
        sortCurvePairs(intersections, MODE);
        segments1 = buildSegments(p1, intersections, MODE, intersectionTracker);
      }
      // then, make sure the curvepairs are sorted w.r.t. t values on p2
      if(p2.segments.size()>0) {
        int MODE = 2;
        sortCurvePairs(intersections, MODE);
        segments2 = buildSegments(p2, intersections, MODE, intersectionTracker);
      }
    }

    // no intersections means we don't segment.
    else {
      segments1 = new ArrayList<PolyBezierCurve>();
      segments1.add(p1);
      segments2 = new ArrayList<PolyBezierCurve>();
      segments2.add(p2);
    }
  }

  /**
   * Split up a polybezier based on a list of intersection 't' values,
   * encoded as part of intersection curve pairs.
   */
  private ArrayList<PolyBezierCurve> buildSegments(PolyBezierCurve p, ArrayList<CurvePair> intersections, int MODE, IntersectionTracker tracker) {
    ArrayList<PolyBezierCurve> segments = new ArrayList<PolyBezierCurve>();
    float t1=0, t2=1.0;
    boolean open = false;
    PolyBezierCurve pbc;
    CurvePair cp;
    for(int c=0, last=intersections.size(); c<last; c++) {
      cp = intersections.get(c);
      t2 = (MODE == 1? cp.t1 : cp.t2);
      pbc = p.split(t1,t2);
      //open = (pbc.getCurveLength()<2);
      if(!open) {
        t1 = t2;
        segments.add(pbc);
        tracker.trackOut(c,pbc,MODE);
        tracker.trackIn((c+1)%last,pbc,MODE);
      }
    }
    // merge last segment with first segment
    pbc = p.split(open?t1:t2)[1];
    segments.get(0).prepend(pbc);
    return segments;
  }

  /**
   * custom quicksort for sorting curvepairs based either on t1 or t2 properties.
   */
  void sortCurvePairs(ArrayList<CurvePair> cp, int MODE) {
    if(cp.size()==0) return;
    if(cp.size()==1) return;
    int pos = int((int)(cp.size()-1)/2);
    CurvePair pivot = cp.get(pos);
    ArrayList<CurvePair> left = new ArrayList<CurvePair>();
    ArrayList<CurvePair> right = new ArrayList<CurvePair>();
    for(int i=cp.size()-1; i>=0; i--) {
      if(i==pos) { cp.remove(i); continue; }
      if(MODE == 1) {
        if(cp.get(i).t1 < pivot.t1) { left.add(cp.get(i)); }
        else { right.add(cp.get(i)); }}
      else if(MODE == 2) {
        if(cp.get(i).t2 < pivot.t2) { left.add(cp.get(i)); }
        else { right.add(cp.get(i)); }}
      cp.remove(i);
    }
    sortCurvePairs(left,MODE);
    for(CurvePair c: left) { cp.add(c); }
    cp.add(pivot);
    sortCurvePairs(right,MODE);
    for(CurvePair c: right) { cp.add(c); }
  }

  /**
   * Get a reference point for ray-crossings
   */
  Point getReference(PolyBezierCurve pbc) {
    Point s = pbc.getFirst().getStart(),
          e = pbc.getLast().getEnd();
    float dx = e.x - s.x,
          dy = e.y - s.y,
          d = dist(s.x,s.y,e.x,e.y);
    dx/=d; dy/=dy;
    return (new Point(dx, dy)).rotateOver(ORIGIN,PI/2).scale(10*dim);
  }

  /**
   * Construct the union outline (i.e. all covered area)
   */
  PolyBezierCurve getUnion() {
    IntersectionTracker generator = intersectionTracker.copy();
    PolyBezierCurve shape = getOperation(UNION, generator);
    return generator.formShape();
  }

  /**
   * Construct the intersection outline (i.e. the overlap only)
   */
  PolyBezierCurve getIntersection() {
    IntersectionTracker generator = intersectionTracker.copy();
    PolyBezierCurve shape = getOperation(INTERSECTION, generator);
    return generator.formShape();
  }

  /**
   * Construct the exclusion outline (i.e. all areas the shapes do not overlap)
   */
  // FIXME: implement?
  PolyBezierCurve getExclusion() { return null; }

  /**
   * generic operator
   */
  PolyBezierCurve getOperation(int op, IntersectionTracker intersectionTracker) {
    PolyBezierCurve shape = new PolyBezierCurve(false);
    int f = 0, cross;
    Point s, e, reference;
    for(PolyBezierCurve pbc: segments1) {
      cross = p2.contains(pbc, getReference(pbc));
      if(cross % 2 == op) {
        for(BezierCurve c: pbc.segments) {
          shape.addCurve(c, false);
        }
        shape.subShape();
      } else { intersectionTracker.remove(pbc); }
    }
    f = 0;
    for(PolyBezierCurve pbc: segments2) {
      cross = p1.contains(pbc, getReference(pbc));
      if(cross % 2 == op) {
        for(BezierCurve c: pbc.segments) {
          shape.addCurve(c, false);
        }
        shape.subShape();
      } else { intersectionTracker.remove(pbc); }
    }
    return shape;
  }
}


/**
 * Intersection tracker for PolyBezierCurve shape pairs
 */


class IntersectionTracker {
  Intersection[] intersections;
  Intersection current;

  // construct a new list, with empty elements.
  IntersectionTracker(int size) {
    intersections = new Intersection[size];
    while(size-->0) { intersections[size] = new Intersection(); }
  }

  IntersectionTracker copy() {
    int L = intersections.length;
    IntersectionTracker copied = new IntersectionTracker(L);
    for(int i=0; i<L; i++) {
      copied.intersections[i] = new Intersection(intersections[i]);
    }
    return copied;
  }

  void trackIn(int idx, PolyBezierCurve c, int MODE) {
    intersections[idx].setIn(c,MODE);
  }

  void trackOut(int idx, PolyBezierCurve c, int MODE) {
    intersections[idx].setOut(c,MODE);
  }

  void remove(PolyBezierCurve c) {
    for(Intersection i: intersections) {
      i.blank(c);
    }
  }

  void draw() { for(Intersection i: intersections) { i.draw(); }}

  /**
   * Form a single shape outline using this tracker's interesection data
   */
  PolyBezierCurve formShape() {
    PolyBezierCurve shape = new PolyBezierCurve(false);
    // initial shape
    Intersection current = intersections[0];
    PolyBezierCurve p=current.getIn(), pout;

    // algorithm walk to add the remaining shapes
    boolean done = false;
    while(!done) {
      shape.append(p);
      current.blank(p);
      pout = current.getOut();
      current.blank();
      current = getAdjoint(pout);
      if(current == null) { done = true; }
      else { p=current.getIn(); }
    }
    // and we're done.
    return shape;
  }

  // get the section that follows this one.
  Intersection getAdjoint(PolyBezierCurve c) {
    Intersection it;
    for(int i=0, pos; i<intersections.length; i++) {
      it = intersections[i];
      pos = it.indexOf(c);
      if(pos>-1) { return it; }
    }
    // there is no adjoint.
    return null;
  }

  // get the next not-empty intersection's
  Intersection getNextShape() {
    for(Intersection i: intersections) {
      if(!i.isEmpty()) { return i; }
    }
    return null;
  }

  String toString() {
    String[] s = new String[intersections.length];
    for(int i=0; i<s.length; i++) {
      s[i] = intersections[i].toString();
    }
    return join(s,"\n");
  }


  /**
   * Inner class. Your code should never get access to instances of this class.
   */
  private class Intersection {
    // has this intersection tracker been passed in an algorithmic run?
    boolean marked = false;
    int other = -1;

    // our in- and out-curves
    PolyBezierCurve c1_in = null,
                    c1_out = null,
                    c2_in = null,
                    c2_out = null;

    // empty contructor
    Intersection() {}

    // copy constructor
    Intersection(Intersection other) {
      c1_in = other.c1_in;
      c1_out = other.c1_out;
      c2_in = other.c2_in;
      c2_out = other.c2_out;
    }

    // setters
    void setIn(PolyBezierCurve c, int MODE)  {
      if(MODE==1) { if(c1_in==null)  c1_in = c;  }
      if(MODE==2) { if(c2_in==null)  c2_in = c;  }
    }

    void setOut(PolyBezierCurve c, int MODE)  {
      if(MODE==1) { if(c1_out==null)  c1_out = c;  }
      if(MODE==2) { if(c2_out==null)  c2_out = c;  }
    }

    // linkers
    void linkIn(Intersection previous) {
      c1_in = previous.c1_out;
      c2_in = previous.c2_out;
    }

    void linkOut(Intersection next) {
      c1_out = next.c1_in;
      c2_out = next.c2_in;
    }

    // blankers
    void blank() { c1_in = null; c1_out = null; c2_in = null; c2_out = null; }
    void blank(PolyBezierCurve c) {
      if(c1_in==c)  c1_in = null;
      if(c1_out==c) c1_out = null;
      if(c2_in==c)  c2_in = null;
      if(c2_out==c) c2_out = null;
    }

    // traversal getters
    PolyBezierCurve getIn() {
      if(c1_in==null && c2_in==null) return null;
      if(c1_in!=null) return c1_in;
      if(c2_in!=null) return c2_in;
      /* it would be interesting if we could get here */
      return null;
    }

    PolyBezierCurve getOut() {
      if(c1_out==null && c2_out==null) return null;
      if(c2_out!=null) return c2_out;
      if(c1_out!=null) return c1_out;
      /* it would be interesting if we could get here */
      return null;
    }

    PolyBezierCurve getOut(int other) {
      if(other==1) { return c2_out; }
      return c1_out;
    }

    PolyBezierCurve getNext(PolyBezierCurve c) {
      if(c1_in==c)       if (c1_out==null) { other = 1; return c2_out; } else { other = 2; return c1_out; }
      else if(c1_out==c) if (c1_in==null)  { other = 1; return c2_in;  } else { other = 2; return c1_in;  }
      else if(c2_in==c)  if (c2_out==null) { other = 2; return c1_out; } else { other = 1; return c2_out; }
      /*if(c2_out==c)*/  if (c2_in==null)  { other = 2; return c1_in;  } else { other = 1; return c2_in;  }
    }

    int indexOf(PolyBezierCurve c) {
      if(c1_in==c || c1_out==c) return 1;
      if(c2_in==c || c2_out==c) return 2;
      return -1;
    }

    boolean isEmpty() {
      return c1_in==null && c1_out==null;
    }

    // this this thing around. out becomes in and vice versa, and the curves need to be flipped, too.
    void flip() {
      // in<->out
      PolyBezierCurve _temp = c1_in;
      c1_in = c1_out;
      c1_out = _temp;
      _temp = c2_in;
      c2_in = c2_out;
      c2_out = _temp;
      // flip curves
      if(c1_in!=null)  c1_in.flip();
      if(c1_out!=null) c1_out.flip();
      if(c2_in!=null)  c2_in.flip();
      if(c2_out!=null) c2_out.flip();
    }

    // algorithmic run marking
    void mark() { marked = true; other = -1; }
    void reset() { marked = false; other = -1; }

    // draw
    void draw() {
      int col = colorListing[int(random(100))];
      if(c1_in!=null)  { c1_in.draw(col);  }
      if(c1_out!=null) { c1_out.draw(col); }
      if(c2_in!=null)  { c2_in.draw(col);  }
      if(c2_out!=null) { c2_out.draw(col); }
    }

    // tostring
    String toString() { return "in: "+c1_in+"/"+c1_out+", out:"+c2_in+"/"+c2_out; }
  }
}

static class CanonicalLayout {

  CanonicalValues getCanonicalValues(Point B3, float s) {
    return new CanonicalValues(B3, s);
  }

  // we along translate the past point, because we know what the other three points will be, by convention.
  static Point forwardTransform(Point p1, Point p2, Point p3, Point p4, float s) {
    float xn = -p1.x + p4.x - (-p1.x+p2.x)*(-p1.y+p4.y)/(-p1.y+p2.y);
    float xd = -p1.x + p3.x - (-p1.x+p2.x)*(-p1.y+p3.y)/(-p1.y+p2.y);
    float np4x = s*xn/xd;

    float yt1 = s*(-p1.y+p4.y) / (-p1.y+p2.y);
    float yt2 = s - (s*(-p1.y+p3.y)/(-p1.y+p2.y));
    float yp = yt2 * xn / xd;
    float np4y = yt1 + yp;

    return new Point(np4x, np4y);
  }

  // the back-translation is equally easy, since we already know the first three coordinates. we just convert point 4.
  static Point backwardTransform(Point p1, Point p2, Point p3, Point p4, float dx, float dy, float s) {
    return new Point(
      (-dy * p1.x + (-dx+dy)*p2.x + dx*p3.x + s*p4.x) / s,
      (-dy * p1.y + (-dx+dy)*p2.y + dx*p3.y + s*p4.y) / s
    );
  }

  static PGraphics create(PApplet sketch, int width, int height, float s) {
    int w = width / 2;
    int h = height / 2;
    float f = s/100;

    PGraphics buffer = sketch.createGraphics(width, height);
    buffer.beginDraw();
    buffer.background(255);
    buffer.translate(w, h);
    buffer.stroke(150);
    for (int i=-w; i<=w; i+=s/2) {
      buffer.line(i, -h, i, h);
    }
    for (int i=-h; i<=h; i+=s/2) {
      buffer.line(-w, i, w, i);
    }
    buffer.stroke(0);
    buffer.line(0, -h, 0, h);
    buffer.line(-w, 0, w, 0);

    // single inflection area
    buffer.stroke(120, 120, 160);
    buffer.fill(0, 255, 0, 50);
    buffer.rect(-w-1, s, 2*w+2, h-s);

    // Loop region
    buffer.fill(255, 0, 0, 50);
    buffer.beginShape();

    // Do some canonical curve work, following Stone and DeRose,
    // "A Geometric Characterization of Parametric Cubic Curves"
    float px=-w*2, py=-h*2;
    for (float y, x=-10; x<=1; x+=0.01) {
      // Cusp parabola:
      y = (-x*x + 2*x + 3)/4;
      buffer.line(px, py, x*s, y*s);
      px = x*s;
      py = y*s;
      buffer.vertex(px, py);
    }

    // loop/arch transition boundary, elliptical section
    px=1*s;
    py=1*s;
    for (float x=1, y; x>=0; x-=0.005) {
      y = 0.5 * (sqrt(3) * sqrt(4*x - x*x) - x);
      buffer.line(px, py, x*s, y*s);
      px = x*s;
      py = y*s;
      buffer.vertex(px, py);
    }

    // loop/arch transition boundary, parabolic section
    px=0;
    py=0;
    for (float x=0, y; x>-w; x-=0.01) {
      y = (-x*x + 3*x)/3;
      buffer.line(px, py, x*s, y*s);
      px = x*s;
      py = y*s;
      buffer.vertex(px, py);
    }
    buffer.endShape();

    buffer.fill(0,0,100);

    buffer.textFont(sketch.createFont("Arial", 18*f));
    buffer.textAlign(CENTER, CENTER);
    buffer.text("simple arch\n(no inflections)", 1.5*s, -1.51*s);
    buffer.text("loop", -175, -175);
    buffer.text("double\ninflection", -2*s, -30*f);
    buffer.text("single inflection", 0, 2*s);
    buffer.text("loop", -1.1*s, -65*f);

    buffer.fill(100);


    buffer.text("cusp", -1.2*s, 20*f);
    buffer.line(-1.4*s, 30*f, -0.65*s, 30*f);

    buffer.text("loop on t=0", -0.8*s, -1.9*s);
    buffer.line(-1.25*s, -1.8*s, -0.3*s, -1.8*s);

    buffer.text("loop on t=1", 0.8*s, 30*f);
    buffer.line(0.08*s, 40*f, 1.2*s, 40*f);

    // our magic coordinates
    buffer.fill(0);
    buffer.ellipse(0,0,5,5);
    buffer.text("(0,0)", 0-20, 0+10);
    buffer.ellipse(0,s,5,5);
    buffer.text("(0,1)", 0-20, s+10);
    buffer.ellipse(s,s,5,5);
    buffer.text("(1,1)", s-20, s+10);

    buffer.endDraw();
    return buffer;
  }
}

static class CanonicalValues {
  float B3x, B3y, A, B, C, discriminant;

  CanonicalValues(Point B3, float s) {
    B3x = B3.x / s;
    B3y = B3.y / s;
    A = 9 * (B3.x + B3.y - 3);
    B = -9 * (B3.x - 3);
    C = -9;
    discriminant = B3x * B3x - 2 * B3x + 4 * B3y - 3;  
  }

  boolean hasLoop() {
    return discriminant < 0; 
  }

  boolean hasCusp() {
    // epislon based "equal to 0"
    return abs(discriminant) < 0.000001; 
  }
}


class CircleAbstractor {

  protected class Point {
    double x, y, s, e, r;
    public Point(double _x, double _y) { x = _x; y = _y; }
    String toString() { return x+","+y+", r:"+r+", s:"+s+", e:"+e; }
  }

  BezierCurve curve;
  double errorThreshold;
  double TAU = Math.PI*2;

  /**
   *
   */
  CircleAbstractor(BezierCurve curve) {
    this(curve, 0.5);
  }

  /**
   *
   */
  CircleAbstractor(BezierCurve curve, double errorThreshold) {
    this.errorThreshold = errorThreshold;
    this.curve = curve;
  }

  /**
   *
   */
  ArrayList<Point> getCircles() {
    return iterate(this.errorThreshold);
  }

  /**
   *
   */
  Point getCCenter(Point p1, Point p2, Point p3) {
    // deltas
    double dx1 = (p2.x - p1.x),
           dy1 = (p2.y - p1.y),
           dx2 = (p3.x - p2.x),
           dy2 = (p3.y - p2.y);

    // perpendiculars (quarter circle turned)
    double dx1p = dx1 * cos(PI/2) - dy1 * sin(PI/2),
           dy1p = dx1 * sin(PI/2) + dy1 * cos(PI/2),
           dx2p = dx2 * cos(PI/2) - dy2 * sin(PI/2),
           dy2p = dx2 * sin(PI/2) + dy2 * cos(PI/2);

    // chord midpoints
    double mx1 = (p1.x + p2.x)/2,
           my1 = (p1.y + p2.y)/2,
           mx2 = (p2.x + p3.x)/2,
           my2 = (p2.y + p3.y)/2;

    // midpoint offsets
    double mx1n = mx1 + dx1p,
           my1n = my1 + dy1p,
           mx2n = mx2 + dx2p,
           my2n = my2 + dy2p;

    // intersection of these lines:
    Point i = lli(mx1,my1,mx1n,my1n, mx2,my2,mx2n,my2n);
    double r = dist(i,p1);

    // arc start/end values, over mid point
    double s = atan2(p1.y - i.y, p1.x - i.x),
           m = atan2(p2.y - i.y, p2.x - i.x),
           e = atan2(p3.y - i.y, p3.x - i.x);

    // determine arc direction (cw/ccw correction)
    double __;
    if (s<e) {
      // if s<m<e, arc(s, e)
      // if m<s<e, arc(e, s + TAU)
      // if s<e<m, arc(e, s + TAU)
      if (s>m || m>e) { s += TAU; }
      if (s>e) { __=e; e=s; s=__; }
    } else {
      // if e<m<s, arc(e, s)
      // if m<e<s, arc(s, e + TAU)
      // if e<s<m, arc(s, e + TAU)
      if (e<m && m<s) { __=e; e=s; s=__; } else { e += TAU; }
    }

    // assign and done.
    i.s = s;
    i.e = e;
    i.r = r;
    return i;
  }

  /**
   *
   */
  Point lli(double x1, double y1, double x2, double y2, double x3, double y3, double x4, double y4) {
    // slight duplication w.r.t BezierComputer.pde
    double nx=(x1*y2-y1*x2)*(x3-x4)-(x1-x2)*(x3*y4-y3*x4),
           ny=(x1*y2-y1*x2)*(y3-y4)-(y1-y2)*(x3*y4-y3*x4),
           d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);
    if(d==0) { return null; }
    return new Point(nx/d, ny/d);
  }

  /**
   *
   */
  ArrayList<Point> iterate(double errorThreshold) {
    ArrayList<Point> circles = new ArrayList<Point>();
    return __iterate(errorThreshold, circles);
  }

  Point get(double t) {
    float s = (float) t;
    return new Point(this.curve.getXValue(s), this.curve.getYValue(s));
  }

  /**
   *
   */
  ArrayList<Point> __iterate(double errorThreshold, ArrayList<Point> circles) {
    double s = 0, e = 1;

    // we do a binary search to find the "good `t` closest to no-longer-good"
    do {
      // step 1: start with the maximum possible arc
      e = 1;
      Point np1 = get(s),
            np2,
            np3,
            pc=null,
            prev_pc;

      boolean curr_good = false,
              prev_good = false,
              done;

      double m = e,
             prev_e = 1;

      int step = 0;

      // step 2: find the best possible arc
      do {
        prev_good = curr_good;
        prev_pc = pc;
        m = (s + e)/2;
        step++;

        np2 = get(m);
        np3 = get(e);
        pc = getCCenter(np1, np2, np3);
        double error = getError(pc, np1, s, e);
        curr_good = error <= errorThreshold;

        //println("params:",s,m,e,prev_e,error);

        done = prev_good && !curr_good;
        if(!done) prev_e = e;

        // this arc is fine: we can move 'e' up to see if we can find a wider arc
        if(curr_good) {
          // if e is already at max, then we're done for this arc.
          if (e >= 1) { prev_e = 1; break; }
          e = e + (e - s)/2;
        }
        // this is a bad arc: we need to move 'e' down to find a good arc
        else { e = m; }
      }
      while(!done);

      //println("arc found:",s,",",prev_e,":",prev_pc.s+","+prev_pc.e);

      prev_pc = prev_pc == null ? pc : prev_pc;
      circles.add(prev_pc);
      s = prev_e;
    }
    while(e < 1);

    return circles;
  }

  /**
   *
   */
  double getError(Point pc, Point np1, double s, double e) {
    double q = (e - s) / 4;

    // get an error estimate baesd on the quarter points
    Point c1 = get(s + q),
          c2 = get(e - q);

    // distance from pc to c1/c2
    double ref = dist(pc, np1),
           d1  = dist(pc, c1),
           d2  = dist(pc, c2);

    return abs(d1-ref) + abs(d2-ref);
  }

  /**
   *
   */
  double dist(Point p1, Point p2) {
    double dx = p1.x - p2.x,
           dy = p1.y - p2.y;
    return sqrt(dx*dx + dy*dy);
  }

}

/***************************************************
 *                                                 *
 *      A generic Bezier curve implementation      *
 *                                                 *
 ***************************************************/

/**
 * Bezier curve class (of any degree)
 */
class BezierCurve {
  int LUT_resolution;
  int order;
  Point[] points,              // the control points for this curve
          abc = new Point[3],  // the "ABC" points. Only for 2nd and 3rd order curves
          span,                // de Casteljau's spanning lines for some t=...
          left_split,          // for any span, these are the control points for the subcurve [0,t]
          right_split,         // for any span, these are the control points for the subcurve [t,1]
          normals;             // the normal vectors for each control point.
  // LUT for the point x/y values and t-at-x/y values
  float[] x_values,
          y_values,
          LUT_x,
          LUT_y ,
          ratios, // the distance from the start, as ratios, for each control point projected onto the curve
          originalInterval = {0,1};
  // for drawing the curve, we use integer lookups
  int[] draw_x = new int[LUT_resolution],
        draw_y = new int[LUT_resolution];
  float span_t = -1,     // indicates the 't' value for which span/left/right was last computed
        curveLength,     // the arc length of this curve, computed on construction
        bias = 0;        // are control points are on one side of the baseline? -1/1 means yes (sign indicates left/right), 0 means no.


  // lower order Bezier curve, if this curve is an elevation
  BezierCurve generator = null;

  // reserved
  protected BezierCurve() {}

  /**
   * construct a typical curve
   */
  BezierCurve(Point[] points) {
    this(points, true);
  }

  BezierCurve(Point[] points, boolean copyPoints) {
    int L = points.length;
    order = L-1;
    if(copyPoints) {
      this.points = new Point[L];
      for(int p=0; p<L; p++) {
        this.points[p] = new Point(points[p].x, points[p].y);
      }
    } else { this.points = points; }
    LUT_resolution = 1 + (int) (400 * log(order)/log(4));
    LUT_x = new float[LUT_resolution];
    LUT_y = new float[LUT_resolution];
    draw_x = new int[LUT_resolution];
    draw_y = new int[LUT_resolution];
    x_values = new float[L];
    y_values = new float[L];
    update();
  }

  /**
   * Update all the cachable information
   * - x/y lookup tables
   * - coordinates in x and y dimensions
   * - curve length
   * - control normals
   */
  void update() {
    span_t = -1;
    generator = null;
    // Split up "point" x- and y- components for quick lookup.
    for(int i=0, last=points.length; i<last; i++) {
      x_values[i] = points[i].x;
      y_values[i] = points[i].y;
    }
    // Create lookup tables for resolving coordinate -> 't' value
    // as well as the int-cast screen point for that 't' value.
    float t, r=(float)(LUT_resolution-1);
    for(int idx=0; idx<LUT_resolution; idx++) {
      t = idx/r;
      // lookup values
      LUT_x[idx] = getXValue(t);
      LUT_y[idx] = getYValue(t);
      // squashed values, for drawing
      draw_x[idx] = (int)round(LUT_x[idx]);
      draw_y[idx] = (int)round(LUT_y[idx]);
    }
    // Determine curve length
    curveLength = (order==1? dist(x_values[0],y_values[0],x_values[1],y_values[1]) : comp.getArcLength(x_values, y_values));
    // Figure out the normals along this curve
    // for each control point.
    normals = new Point[order+1];
    normals[0] = getNormal(0);
    normals[order] = getNormal(1);
    ratios = new float[order+1];
    ratios[0] = 0;
    for(int i=1; i<=order; i++) {
      t = getPointProjection(points[i]);
      normals[i] = getNormal(t);
      int mindist_idx = int(t*LUT_resolution);
      float partialLength = (order==1 ? dist(x_values[0],y_values[0],LUT_x[mindist_idx],LUT_y[mindist_idx])
                                       : comp.getArcLength(t, x_values, y_values));
      ratios[i] = partialLength/curveLength;
    }
    ratios[order] = 1;
    // Is this curve biased? i.e. are all the control
    // points on one side of the baseline?
    if(order>1) {
      bias = comp.getSide(points[0],points[order],points[1]);
      for(int i=2; i<order; i++) {
        if(comp.getSide(points[0],points[order],points[i])!=bias) {
          bias = 0;
          break; }}}
  }

  /**
   * Get the first point in this curve
   */
  Point getStart() { return points[0]; }

  /**
   * Get the last point in this curve
   */
  Point getEnd() { return points[order]; }

  /**
   * find an approximate t value that acts as the control's
   * projection onto the curve, towards the origin.
   */
  float getPointProjection(Point p) {
    float t=0.5, pdist, mindist=9999999, tp, tn;
    int mindist_idx=0;
    // find a reasonable initial "t"
    for(int idx=0; idx<LUT_resolution; idx+=1) {
      pdist = dist(p.x, p.y, LUT_x[idx], LUT_y[idx]);
      if(pdist<mindist) {
        mindist = pdist;
        mindist_idx = idx;
        t = (float)idx/(float)LUT_resolution; }}
    t = refineProjection(p, t, mindist, 1.0/(1.01*LUT_resolution));
    return t;
  }

  /**
   * Refine a point projection's [t] value.
   */
  float refineProjection(Point p, float t, float distance, float precision) {
    if(precision < 0.0001) return t;
    // refinement
    float prev_t = t-precision,
          next_t = t+precision;
    Point prev = getPoint(prev_t),
          next = getPoint(next_t);
    float prev_distance = dist(p.x, p.y, prev.x, prev.y),
          next_distance = dist(p.x, p.y, next.x, next.y);
    // smaller distances?
    if(prev_t >= 0 && prev_distance < distance) { return refineProjection(p, prev_t, prev_distance, precision); }
    if(next_t <= 1 && next_distance < distance) { return refineProjection(p, next_t, next_distance, precision); }
    // larger distances
    return refineProjection(p, t, distance, precision/2.0);
  }

  // how close are these two curves?
  float getSimilarity(BezierCurve other) {
    float diff = 0, dx, dy, d;
    for(int i=0; i<points.length; i++) {
      dx = points[i].x - other.points[i].x;
      dy = points[i].y - other.points[i].y;
      d = sqrt(dx*dx+dy*dy);
      diff += d;
    }
    return diff;
  }

  /**
   * Get values
   */
  float getXValue(float t) { return comp.getValue(t, x_values); }
  float getYValue(float t) { return comp.getValue(t, y_values); }
  Point getPoint(float t)  { return new Point(getXValue(t), getYValue(t)); }

  /**
   * Get derivative values
   */
  float getDXValue(float t) { return comp.getDerivative(1, t, x_values);  }
  float getDYValue(float t) { return comp.getDerivative(1, t, y_values);  }
  Point getDerivativePoint(float t)  { return new Point(getDXValue(t), getDYValue(t)); }
  Point[] getSpanLines(float t)  {
    Point[] span = generateSpan(t);
    int prev = span.length-3, b = span.length-1, next = span.length-2;
    Point p1 = new Point(span[prev].x-span[b].x, span[prev].y-span[b].y);
    Point p2 = new Point(span[next].x-span[b].x, span[next].y-span[b].y);
    return new Point[]{p1, p2};
  }

  /**
   * Get second derivative values
   */
  float getD2XValue(float t) { return comp.getDerivative(2, t, x_values);   }
  float getD2YValue(float t) { return comp.getDerivative(2, t, y_values);   }
  Point getSecondDerivativePoint(float t)  { return new Point(getD2XValue(t), getD2YValue(t)); }

  /**
   * get a point-normal
   */
  Point getNormal(float t) {
    float dx = getDXValue(t),
          dy = getDYValue(t),
          a = -PI/2,
          ca = cos(a),
          sa = sin(a),
          nx = dx*ca - dy*sa,
          ny = dx*sa + dy*ca,
          dst = sqrt(nx*nx+ny*ny);
    return new Point(nx/dst, ny/dst);
  }

  /**
   * Get the spanning lines for this curve at t = ...
   * While we do this, we also calculate the A/B/C points,
   * as well as the split curves for [t], since this requires
   * the same information.
   */
  Point[] generateSpan(float t) {
    span_t = t;
    left_split = new Point[order+1];
    right_split = new Point[order+1];
    int l = 0, r = order;
    Point[] span = new Point[comp.markers(order+1)];
    arrayCopy(points,0,span,0,points.length);
    Point p1, p2, p3;
    int next = points.length;
    for(int c = order; c>0; c--) {
      left_split[l++] = span[next-c-1];
      for(int i = 0; i<c; i++) {
        p1 = span[next-c-1];
        p2 = span[next-c];
        p3 = new Point(lerp(p1.x, p2.x, t), lerp(p1.y, p2.y, t));
        if(c==3 && i==1) { abc[0] = p3; }
        span[next++] = p3;
      }
      right_split[r--] = span[next-c-1];
    };
    left_split[l] = span[next-1];
    right_split[0] = span[next-1];
    // fill in the ABC array
    int last = span.length - 1;
    abc[0] = (order%2==0 ? span[order/2] : span[order + order - 1]);
    abc[1] = span[last];
    abc[2] = comp.getProjection(abc[0], abc[1], span[0], span[order]);
    // and finally, return the span lines
    return span;
  }

  /**
   * compute the bounding box for a curve
   */
  Point[] generateBoundingBox() {
    float[] inflections = getInflections();
    float mx=999999, MX=-999999, my=mx, MY=MX, x, y, t;
    for(int i=0; i<inflections.length; i++) {
      t = inflections[i];
      x = getXValue(t);
      y = getYValue(t);
      if(x < mx) { mx = x; }
      if(x > MX) { MX = x; }
      if(y < my) { my = y; }
      if(y > MY) { MY = y; }
    }
    Point[] bbox = {new Point(mx,my), new Point(MX,my), new Point(MX,MY), new Point(mx,MY)};
    return bbox;
  }

  /**
   * Get the bounding box area
   */
  float getArea() {
    Point[] bbox = generateBoundingBox();
    float dx = bbox[2].x - bbox[0].x,
          dy = bbox[2].y - bbox[0].y,
          A = dx*dy;
    return A;
  }

  /**
   * Generate a bounding box for the aligned curve
   */
  Point[] generateTightBoundingBox() {
    float ox = points[0].x,
          oy = points[0].y,
          angle = atan2(points[order].y - points[0].y, points[order].x - points[0].x) + PI,
          ca = cos(angle),
          sa = sin(angle),
          nx, ny;
    Point[] bbox = align().generateBoundingBox();
    for(Point p: bbox) {
      nx = (p.x * ca - p.y * sa) + ox;
      ny = (p.x * sa + p.y * ca) + oy;
      p.x = nx;
      p.y = ny;
    }
    return bbox;
  }

  /**
   * Is there an overlap between these two curves,
   * based on their bounding boxes?
   */
  boolean hasBoundOverlapWith(BezierCurve other) {
    Point[] bbox = generateBoundingBox(),
            obbox = other.generateBoundingBox();
    float dx = abs(bbox[2].x - bbox[0].x)/2,
           dy = abs(bbox[2].y - bbox[0].y)/2,
           odx = abs(obbox[2].x - obbox[0].x)/2,
           ody = abs(obbox[2].y - obbox[0].y)/2,
           mx = bbox[0].x + dx,
           my = bbox[0].y + dy,
           omx = obbox[0].x + odx,
           omy = obbox[0].y + ody,
           distx = abs(mx-omx),
           disty = abs(my-omy),
           tx = dx + odx,
           ty = dy + ody;
    return distx < tx && disty < ty;
  }

  /**
   * Just the X curvature
   */
  BezierCurve justX(float h) {
    int L = points.length, l = L - 1;
    Point[] newPoints = new Point[L];
    for(int i=0; i<L; i++) {
      newPoints[i] = new Point(i*h/l, points[i].x);
    }
    return new BezierCurve(newPoints);
  }

  /**
   * Just the Y curvature
   */
  BezierCurve justY(float h) {
    int L = points.length, l = L - 1;
    Point[] newPoints = new Point[L];
    for(int i=0; i<L; i++) {
      newPoints[i] = new Point(i*h/l, points[i].y);
    }
    return new BezierCurve(newPoints);
  }

  /**
   * Reverse this curve
   */
  void reverse() {
    Point[] newPoints = new Point[points.length];
    for(int i=0; i<points.length; i++) {
      newPoints[order-i] = points[i];
    }
    points = newPoints;
    update();
  }

  /**
   * Determine whether all control points are on
   * one side of the baseline. If so, this curve
   * is biased, making certain computations easier.
   */
  boolean isBiased() { return bias != 0; }

  /**
   * return the arc length for this curve.
   */
  float getCurveLength() { return curveLength; }
  float getCurveLength(int n) { return comp.getArcLength(1, n, x_values, y_values); }

  /**
   * Get the A/B/C points for this curve. These are only
   * meaningful for quadratic and cubic curves.
   */
  Point[] getABC(float t) {
    generateSpan(t);
    return abc;
  }

  /**
   * Get the distance of the curve's midpoint to the
   * baseline (start-end). The smaller this value is,
   * the more linear a simple curve will be. For
   * non-simple curves, this value is relatively useless.
   */
  float getScaleAngle() {
    Point p1 = getNormal(0), p2 = getNormal(1);
    return abs(atan2(p1.x*p2.y - p2.x*p1.y, p1.x*p2.x + p1.y*p2.y) % 2*PI);
  }

  /**
   * Get the t-interval, with respects to the ancestral curve.
   */
  float[] getInterval() {
    return originalInterval;
  }

  /**
   * Bound when splitting curves: mark which [t] values on the original curve
   * the start and end of this curve correspond to. Note that if this curve is
   * the result of multiple splits, the "original" is the ancestral curve
   * that the very first split() was called on.
   */
  void setOriginalT(float d1, float d2) {
    originalInterval[0] = d1;
    originalInterval[1] = d2;
  }


  /**
   * Split in half
   */
  BezierCurve[] split() {
    BezierCurve[] subcurves = split(0.5);
    float mid = (originalInterval[0] + originalInterval[1])/2;
    subcurves[0].setOriginalT(originalInterval[0], mid);
    subcurves[1].setOriginalT(mid, originalInterval[1]);
    return subcurves;
  }

  /**
   * Split into two curves at some [t] value
   */
  BezierCurve[] split(float t) {
    if (t != span_t) { generateSpan(t); }
    BezierCurve[] subcurves = {new BezierCurve(left_split), new BezierCurve(right_split)};
    return subcurves;
  }

  /**
   * Get the segment from t1 to t2 as new curve
   */
  BezierCurve split(float t1, float t2) {
    BezierCurve segment;
    if(t1==0) { segment = split(t2)[0]; }
    else if(t2==1) { segment = split(t1)[1]; }
    else {
      BezierCurve[] subcurves = split(t1);
      t2 = (t2-t1)/(1-t1);
      subcurves = subcurves[1].split(t2);
      segment = subcurves[0];
    }
    return segment;
  }

  /**
   * Scale this curve. Note that this is NOT
   * the same as offsetting the curve. We're
   * literally just scaling the coordinates.
   */
  BezierCurve scale(float f) {
    int L = points.length;
    Point[] scaled = new Point[L];
    Point p;
    for (int i=0; i<L; i++) {
      p = points[i];
      scaled[i] = new Point(f * p.x, f * p.y);
    }
    return new BezierCurve(scaled);
  }

  /**
   * Align this curve: rotate it so that the first and last coordinates line up,
   * and shift it so that the first coordinate is (0,0), which simplifies the formulae.
   */
  BezierCurve align() {
    return align(points[0], points[order]);
  }

  /**
   * Align this curve to a line defined by two points: rotate it so that the line
   * start is on (0,0), and rotate it so the angle is 0.
   */
  BezierCurve align(Point start, Point end) {
    float angle = atan2(end.y - start.y, end.x - start.x) + PI,
          ca = cos(-angle),
          sa = sin(-angle),
          ox = start.x,
          oy = start.y;
    int L = points.length;
    Point[] aligned = new Point[L];
    Point p = points[0];
    for (int i=0; i<L; i++) {
      p = points[i];
      p = new Point(ca * (p.x-ox) - sa * (p.y-oy), sa * (p.x-ox) + ca * (p.y-oy));
      aligned[i] = p;
    }
    return new BezierCurve(aligned);
  }

  /**
   * Normalise this curve: scale all coordinate to within a unit rectangle.
   */
  BezierCurve normalize() {
    int L = points.length;
    Point[] normalised = new Point[L];
    Point p = points[0];
    float mx = 999999, my = mx,
          MX = -999999, MY = MX;
    for (int i=0; i<L; i++) {
      p = points[i];
      if(p.x<mx) { mx = p.x; }
      if(p.y<my) { my = p.y; }
      if(p.x>MX) { MX = p.x; }
      if(p.y>MY) { MY = p.y; }
      normalised[i] = p;
    }
    for (int i=0; i<L; i++) {
      normalised[i].x = map(normalised[i].x,  mx,MX,  0,1);
      normalised[i].y = map(normalised[i].y,  my,MY,  0,1);
    }
    return new BezierCurve(normalised);
  }

  /**
   * Elevate this curve by one order
   */
  BezierCurve elevate() {
    int L = points.length;
    Point[] elevatedPoints = new Point[L+1];
    elevatedPoints[0] = new Point(LUT_x[0], LUT_y[0]);
    float np1 = order+1, nx, ny;
    for(int i=1; i<L; i++) {
      nx = (i/np1) * x_values[i-1] + (np1-i)/np1 * x_values[i];
      ny = (i/np1) * y_values[i-1] + (np1-i)/np1 * y_values[i];
      elevatedPoints[i] = new Point(nx,ny);
    }
    elevatedPoints[L] = new Point(x_values[L-1], y_values[L-1]);
    BezierCurve b = new BezierCurve(elevatedPoints);
    b.setLower(this);
    return b;
  }

  /**
   * Fix the "lower" degree curve for this Bezier curve.
   * The moment any of the curve points are modified, this
   * lower degree curve is discarded.
   */
  void setLower(BezierCurve parent) { generator = parent; }

  /**
   * Lower the curve's complexity, if we can. Which basically
   * means "if this curve was raised without the coordinates
   * having been touched, since". Otherwise we fake it, by
   *
   */
  BezierCurve lower() {
    if(generator!=null) return generator;
    if(order==1) return this;
    Point[] newPoints = new Point[order];
    float x, y;
    newPoints[0] = points[0];
    // FIXME: this is not very good lowering =)
    for(int i=1; i<order; i++) {
      x = lerp(points[i-1].x,points[i].x,0.5);
      y = lerp(points[i-1].y,points[i].y,0.5);
      newPoints[i] = new Point(x,y);
    }
    newPoints[order-1] = points[order];
    return new BezierCurve(newPoints);
  }

  /**
   * Get all 't' values for which this curve inflects.
   * NOTE: this is an expensive operation!
   */
  float[] getInflections() {
    float[] ret = {};
    ArrayList<Float> t_values = new ArrayList<Float>();
    t_values.add(0.0);
    t_values.add(1.0);
    float[] roots;
    // get first derivative roots
    roots = comp.findAllRoots(1, x_values);
    for(float t: roots) { if(0 < t && t < 1) { t_values.add(t); }}
    roots = comp.findAllRoots(1, y_values);
    for(float t: roots) { if(0 < t && t < 1) { t_values.add(t); }}
    // get second derivative roots
    if(order>2) {
      roots = comp.findAllRoots(2, x_values);
      for(float t: roots) { if(0 < t && t < 1) { t_values.add(t); }}
      roots = comp.findAllRoots(2, y_values);
      for(float t: roots) { if(0 < t && t < 1) { t_values.add(t); }}
    }
    // sort roots
    ret = new float[t_values.size()];
    for(int i=0; i<ret.length; i++) { ret[i] = t_values.get(i); }
    ret = sort(ret);
    // remove duplicates
    t_values = new ArrayList<Float>();
    for(float f: ret) { if(!t_values.contains(f)) { t_values.add(f); }}
    ret = new float[t_values.size()];
    for(int i=0; i<ret.length; i++) { ret[i] = t_values.get(i); }
    if(ret.length > (2*order+2)) {
      String errMsg = "ERROR: getInflections is returning way too many roots ("+ret.length+")";
      if(javascript != null) { javascript.console.log(errMsg); } else { println(errMsg); }
      return new float[0];
    }
    return ret;
  }

  /**
   * Add a slice to this curve's offset subcurves. If a slice
   * is too complex (i.e. has more than one inflection point)
   * we split it up into two simpler curves, because otherwise
   * normal-based offsetting will look really wrong.
   */
  void addSlices(ArrayList<BezierCurve> slices, BezierCurve c) {
    BezierCurve bc = c.align();
    float[] inflections = bc.getInflections();
    if(inflections.length>3) {
      BezierCurve[] splitup = c.split(0.5);
      addSlices(slices, splitup[0]);
      addSlices(slices, splitup[1]);
    } else { slices.add(c); }
  }

  /**
   * Slice up this curve along its inflection points.
   */
  ArrayList<BezierCurve> getSlices() {
    float[] inflections = align().getInflections();
    ArrayList<BezierCurve> slices = new ArrayList<BezierCurve>();
    for(int i=0, L=inflections.length-1; i<L; i++) {
      addSlices(slices, split(inflections[i], inflections[i+1]));
    }
    return slices;
  }

  /**
   * Graduated-offset this curve along its normals,
   * without segmenting it.
   */
  BezierCurve simpleOffset(float offset) { return simpleOffset(offset,1,1); }
  BezierCurve simpleOffset(float offset, float start, float end) {
    float moveStart = map(start,0,1,0,offset),
          moveEnd =  map(end,0,1,0,offset),
          dx, dy;
    Point[] newPoints = new Point[order+1];
    for(int i=0; i<=order; i++) {
      dx = map(ratios[i],0,1,moveStart,moveEnd);
      dy = map(ratios[i],0,1,moveStart,moveEnd);
      dx *= normals[i].x;
      dy *= normals[i].y;
      newPoints[i] = new Point(points[i].x + dx, points[i].y + dy); }
    return new BezierCurve(newPoints);
  }

  /**
   * Offset the entire curve by some interpolating distance,
   * starting at offset [start] and ending at offset [end].
   * Segmenting it based on inflection points.
   */
  BezierCurve[] offset(float distance) { return offset(distance, 1, 1); }
  BezierCurve[] offset(float distance, float start, float end) {
    BezierCurve segment;
    ArrayList<BezierCurve> segments = new ArrayList<BezierCurve>(),
                           slices = getSlices();
    float S = 0, L = getCurveLength(), s, e;
    for(int b=0; b<slices.size(); b++) {
      segment = slices.get(b);
      s = map(S, 0,L, start,end);
      S += segment.getCurveLength();
      e = map(S, 0,L, start,end);
      segment = segment.simpleOffset(distance, s, e);
      segments.add(segment);
    }
    return makeOffsetArray(segments);
  }

  // arraylist -> [], with normal correction if needed.
  private BezierCurve[] makeOffsetArray(ArrayList<BezierCurve> segments) {
    // Step 3: convert the arraylist to an array, and return
    BezierCurve[] offsetCurve = new BezierCurve[segments.size()];
    for(int b=0; b<segments.size(); b++) {
      offsetCurve[b] = segments.get(b);
      if(b>0 && !simplifiedFunctions) {
        // We used estimations for the control-projections,
        // so the start and end normals may in fact be wrong.
        // make sure they line up by "pulling them together".
        correctIfNeeded(offsetCurve[b-1], offsetCurve[b]);
      }
    }
    // and we're done!
    return offsetCurve;
  }

  /**
   * When offsetting curves, it's possible that on strong
   * curvatures the normals for start and end points of
   * adjacent segments do not line up. In those cases, we
   * need to rotate the normals, which means moving the
   * control points, to ensure a continuously differentiable
   * polybezier.
   */
  void correctIfNeeded(BezierCurve prev, BezierCurve next) {
    float p2 = PI/2;
    Point n1 = prev.getNormal(1),
          n2 = next.getNormal(0),
          n2p = new Point(n2.x*cos(p2)-n2.y*sin(p2), n2.x*sin(p2)+n2.y*cos(p2));
    float diff = acos(n1.x*n2.x + n1.y*n2.y),
          sign = (acos(n1.x*n2p.x + n1.y*n2p.y) < p2 ? 1 : -1);
    // If the angle between the two normals can be resolved,
    // do so. Otherwise --if it's too big-- leave it be. It'll
    // be in an inside-curve, and thus occluded.
    if(diff>PI/20 && diff<PI/2) {
      prev.points[order-1].rotateOver(prev.points[order], -sign * diff/2);
      prev.update();
      next.points[1].rotateOver(next.points[0], sign * diff/2);
      next.update();
    }
  }

  /**
   * return the approximate 't' that the mouse
   * is near. If no approximate value can be found,
   * return -1, which is an impossible value.
   */
  float over(float mx, float my) {
    float r = (float)(LUT_resolution-1);
    for(int idx=0; idx<LUT_resolution; idx++) {
      if(abs(LUT_x[idx] - mx) < 5 && abs(LUT_y[idx] - my) < 5) {
        return idx/r;
      }
    }
    return -1;
  }

  /**
   * return the point we are over, if we're over a point
   */
  int overPoint(float mx, float my) {
    Point p;
    for(int i=0, last=order+1; i<last; i++) {
      p = points[i];
      if(abs(p.x-mx) < 5 && abs(p.y-my) < 5) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Move a curve point
   */
  void movePoint(int idx, float nx, float ny) {
    Point p = points[idx];
    p.x = nx;
    p.y = ny;
    update();
  }

  /**
   * draw this curve
   */
  void draw() { draw(30); }
  void draw(int c) {
    if(showAdditionals && showControlPoints && showPointPoly) {
      drawControlLines();
    }
    float t=0;
    int nx, ny, ox = draw_x[0], oy = draw_y[0];
    for(int idx=0; idx<LUT_resolution; idx++) {
      stroke(c);
      nx = draw_x[idx];
      ny = draw_y[idx];
      if(nx==ox && ny==oy) continue;
      if(drawConnected) { line(ox,oy,nx,ny); }
      else { point(nx, ny); }
      ox=nx;
      oy=ny;
    }
    if(showAdditionals) {
      drawPoints();
    }
  }

  void drawControlLines() {
    stroke(0,100);
    for(int i=1; i<=order; i++) {
      Point p1 = points[i-1];
      Point p2 = points[i];
      line(p1.x,p1.y,p2.x,p2.y);
    }
  }

  void drawPoints() {
    for(int i=0; i<=order; i++) {
      stroke(0,0,200);
      Point p = points[i];
      if(i==0 || i==order) {
        fill(0,0,255);
        p.draw("p"+(i+1)+": ");
      } else {
        noFill();
        if(showControlPoints) { p.draw("p"+(i+1)+": "); }
      }
    }
  }

  String toString() {
    String ret = "B"+order+": ";
    for(int i=0; i<points.length; i++) {
      ret += points[i].toString();
      if(i<order) ret += ", ";
    }
    return ret;
  }
}

/**
 * a null curve is what you get if you derive beyond what the curve supports.
 */
class NullBezierCurve extends BezierCurve {
  NullBezierCurve() { super(); }
  BezierCurve getDerivative() { return this; }
  float getValue(float t) { return 0; }
}


/**
 * Fixed color list
 */
int[] colorListing = new int[100];

void setupColors() {
  for(int i=0; i<colorListing.length; i++) {
    randomSeed(i);
    colorListing[i] = color(random(255),random(255),random(255));
  }
}

int getColor(float idx) { return colorListing[int(idx) % 100]; }

// constants
final Point ORIGIN = new Point(0,0);

// quasi-universal sketch dimensions
final int dim = 300;
final int pad = 20;
// the default 2nd order curve
void setupDefaultQuadratic() {
  Point[] points = {
    new Point(70,250),
    new Point(20,110),
    new Point(250,60)
  };
  curves.add(new BezierCurve(points));
}

// the default 3rd order curve
void setupDefaultCubic() {
  Point[] points = {
    new Point(120,160),
    new Point(35,200),
    new Point(220,260),
    new Point(220,40)
  };
  curves.add(new BezierCurve(points));
}

// the default 2nd order poly-curve
void setupDefaultQuadraticPoly() {
  PolyBezierCurve p = new PolyBezierCurve(true);
  p.addCurve(new BezierCurve(new Point[]{
    new Point(1/3.0*dim, 2/3.0*dim),
    new Point(1/6.0*dim, 1/2.0*dim),
    new Point(1/3.0*dim, 1/3.0*dim)
  }));
  p.addCurve(new BezierCurve(new Point[]{ ORIGIN, ORIGIN, new Point(2/3.0*dim,1/3.0*dim) }));
  p.addCurve(new BezierCurve(new Point[]{ ORIGIN, ORIGIN, new Point(2/3.0*dim,2/3.0*dim) }));
  polycurves.add(p);
}

// the default 3rd order poly-curve
void setupDefaultCubicPoly() {
  int pad = dim/3;
  float k = 0.55228;
  PolyBezierCurve p = new PolyBezierCurve(true);
  p.addCurve(new BezierCurve(new Point[]{
    new Point(dim/2, dim/2+pad),
    new Point(dim/2 + k*pad, dim/2+pad),
    new Point(dim/2 + pad, dim/2 + k*pad),
    new Point(dim/2 + pad, dim/2)
  }));
  p.addCurve(new BezierCurve(new Point[]{
    ORIGIN,
    ORIGIN,
    new Point(dim/2 + k*pad, dim/2-pad),
    new Point(dim/2, dim/2-pad)
  }));
  p.addCurve(new BezierCurve(new Point[]{
    ORIGIN,
    ORIGIN,
    new Point(dim/2-pad, dim/2-k*pad),
    new Point(dim/2-pad, dim/2)
  }));
  polycurves.add(p);
}

/**
 * Draw a bounding box
 */
void drawBoundingBox(Point[] p) {
  if(p==null) return;
  pushStyle();
  stroke(0,255,0);
  line(p[0].x,p[0].y,p[1].x,p[1].y);
  line(p[1].x,p[1].y,p[2].x,p[2].y);
  line(p[2].x,p[2].y,p[3].x,p[3].y);
  line(p[3].x,p[3].y,p[0].x,p[0].y);
  popStyle();
}

// draw all the spanlines generated by a curve
void drawSpan(BezierCurve curve, float t) {
  Point[] span = curve.generateSpan(t);
  int order = curve.order;
  if(!showSpan) return;
  int next = order+1;
  for(int c = order; c>0; c--) {
    stroke(0,map(c,1,order,255,0),map(c,1,order,0,255));
    for(int i = 0; i<c; i++) {
      line(span[next-c-1].x, span[next-c-1].y, span[next-c].x, span[next-c].y);
      ellipse(span[next-c-1].x, span[next-c-1].y, 3, 3);
      ellipse(span[next-c].x, span[next-c].y, 3, 3);
      next++;
    }
  };
}

// draw an offset curve
void drawOffset(BezierCurve curve, float distance) {
  boolean restore = showAdditionals;
  showAdditionals = false;
  for(BezierCurve b: curve.offset(-distance)) { b.draw(); }
  for(BezierCurve b: curve.offset( distance)) { b.draw(); }
  showAdditionals = restore;
}

/***************************************************
 *                                                 *
 *              Sketch framework code              *
 *                                                 *
 ***************************************************/

/**
  Generic main sketch code. All the important bits happen in whatever supplies drawFunction()
**/
BezierComputer comp = new BezierComputer();
BezierComputer getComputer() { return comp; }

ArrayList<BezierCurve> curves = new ArrayList<BezierCurve>();
ArrayList<BezierCurve> getCurves() { return curves; }

ArrayList<PolyBezierCurve> polycurves = new ArrayList<PolyBezierCurve>();
ArrayList<PolyBezierCurve> getPolyCurves() { return polycurves; }

// JS reference
JavaScript javascript = null;

// some default 't' numbers
float t = 0, step = 0.002;
PApplet sketch;

/**
 * set up a curve, and show everything we know about it.
 */
void setup() {
  sketch = this;
  ellipseMode(CENTER);
  // force text engine load (only needed for Processing)
  text("",0,0);
  setupColors();
  noLoop();
  reset();
}

// reset all the things
void reset() {
  // reset values
  curves.clear();
  t = 0;
  step = 0.002;
  // reset methods
  setupScreen();
  noAnimate();
  setupCurve();
  noReset();
}

/**
 * Pass-through that takes care of [t] incrementing
 */
void draw() {
  if(ghosting && frameCount>1) {
    strokeWeight(0);
    fill(255,10);
    rect(-1,-1,width+1,height+1);
    strokeWeight(1);
  } else { background(255); }
  if(playing) { preDraw(); }
  drawFunction();
  if(playing) { postDraw(); }

  // PJS patching
  resetMatrix();

  if(animated && !playing) {
    pushStyle();
    fill(255,0,0,25);
    textAlign(CENTER,CENTER);
    textSize(dim/9);
    text("Animated sketch\nCick to play/pause", width/2, height/2);
    popStyle();
  }
}

int panelDim = dim;

/**
 * pad the sketch translation
 */
void usePanelPadding() {
  translate(pad, pad);
  panelDim = dim - 2*pad;
}

/**
 * switch drawing over to the next dim*dim area
 */
void nextPanel() {
  translate(dim,0);
}

// draws a set of labeled axes
void drawAxes(String horizontalLabel, float hs, float he, String verticalLabel, float vs, float ve) {
  pushStyle();
  stroke(0);
  line(0,0,panelDim,0);
  line(0,0,0,panelDim);
  fill(0);
  // horizontal
  textAlign(CENTER);
  text(horizontalLabel + " →",panelDim/2,-8);
  textAlign(LEFT);
  hs = int(1000*hs)/1000;
  text(""+hs,0,-2);
  textAlign(RIGHT);
  he = int(1000*he)/1000;
  text(""+he,panelDim,-2);
  // vertical
  textAlign(RIGHT);
  text(verticalLabel + "\n↓",-8,panelDim/2);
  textAlign(RIGHT,TOP);
  vs = int(1000*vs)/1000;
  text(""+vs,-2,0);
  textAlign(RIGHT,BOTTOM);
  ve = int(1000*ve)/1000;
  text(""+ve,-2,panelDim);
  // clear
  popStyle();
}

/***************************************************
 *                                                 *
 *      Mouse and keyboard interaction code        *
 *                                                 *
 ***************************************************/

// Runs before drawFunction is called,
// if this is an animate sketch.
void preDraw() {
  if(t>1) {
    t = 0;
  }
}

// Runs after drawFunction is called,
// if this is an animate sketch.
void postDraw() {
  t += step;
}

BezierCurve active = null;
int current = -1,
    offset = 0;


// curve interaction based on mouse movement alone
void mouseMoved() {
  if(curves.size() > 0) {
    for(BezierCurve curve: curves) {
      int p = curve.overPoint(mouseX, mouseY);
      current = p;
      if(p != -1) {
        active = curve;
        cursor(HAND);
        if(redrawOnMouseMove) { redraw(); }
        return;
      }
      if(moulding) {
        if(testCurveMoulding(curve, mouseX, mouseY)) {
          if(redrawOnMouseMove) { redraw(); }
          return;
        }
      }
    }
    cursor(ARROW);
    current = -1;
  }
  if(redrawOnMouseMove) { redraw(); }
}

// point/curve dragging
void mouseDragged() {
  if(current != -1) {
    active.movePoint(current, mouseX, mouseY);
  }
  if(moulding) {
    for(BezierCurve curve: curves) {
      mouldCurve(curve, mouseX, mouseY);
    }
  }
  if(!animated || !playing) redraw();
}

// playback control
void mouseClicked() {
  if(animated) {
    if(playing) { pause(); }
    else { play(); }
  }
}

// selection using the mouse
void mousePressed() {
  if(resetAllowed) { reset(); }
  if(moulding && current==-1) {
    for(BezierCurve curve: curves) {
      float t = curve.over(mouseX, mouseY);
      if(t != -1) {
        startCurveMoulding(curve, t);
      }
    }
  }
  if(!animated || !playing) redraw();
}

// end-of-interaction trigger
void mouseReleased() {
  current = -1;
  active = null;
  if(moulding) {
    for(BezierCurve curve: curves) {
      endCurveMoulding(curve);
    }
  }
  if(!animated || !playing) redraw();
}

// modifier monitoring
boolean shift = false,
         control = false,
         alt = false;

// key input handling
void keyPressed() {

  if(keyCode==SHIFT)   { shift   = true; }
  if(keyCode==CONTROL) { control = true; }
  if(keyCode==ALT)     { alt     = true; }

  for(BezierCurve curve: curves) {
    if(allowReordering && keyCode==38) {
      curves.set(curves.indexOf(curve), curve.elevate());
      if(!animated || !playing) { redraw(); }
    }
    else if(allowReordering && keyCode==40 && curve.lower()!=null) {
      curves.set(curves.indexOf(curve), curve.lower());
      if(!animated || !playing) { redraw(); }
    }
    else if(animated && str(key).equals(" ")) {
      togglePlaying();
    }
    else if(str(key).equals("g")) {
      toggleGhosting();
    }
    else if(str(key).equals("s")) {
      toggleSimplify();
    }
    else if(str(key).equals("p")) {
      toggleSpan();
    }
    else if(allowOffsetting && str(key).equals("+")) {
      offset++;
      if(!animated || !playing) redraw();
    }
    else if(allowOffsetting && str(key).equals("-")) {
      offset--;
      if(offset<0) offset=0;
      if(!animated || !playing) redraw();
    }
  }
}

// modifier monitoring
void keyReleased() {
  if(keyCode==SHIFT)   { shift   = false; }
  if(keyCode==CONTROL) { control = false; }
  if(keyCode==ALT)     { alt     = false; }
}


/***************************************************
 *                                                 *
 *      Additional "use"/"don't use" API           *
 *                                                 *
 ***************************************************/

boolean animated = false;
void animate() { animated = true; loop(); }
void noAnimate() { animated = false; noLoop(); }
void toggleAnimate() { animated = !animated; }

boolean moulding = false;
void mould() { moulding = true; }
void noMoulding() { moulding = false; }
void toggleMoulding() { moulding = !moulding; }

boolean ghosting = false;
void ghost() { ghosting = true; }
void noGhost() { ghosting = false; }
void toggleGhosting() { if(ghosting) { noGhost(); } else { ghost(); }}

boolean playing = false;
void play() { playing = true; loop(); }
void pause() { playing = false; noLoop(); }
void togglePlaying() { if(playing) { pause(); } else { play(); }}

boolean showLabels = true;
void labels() { showLabels = true; }
void noLabels() { showLabels = false; }
void toggleLabels() { showLabels = !showLabels; }

boolean showControlPoints = true;
void controls() { showControlPoints = true; }
void noControls() { showControlPoints = false; }
void toggleControls() { showControlPoints = !showControlPoints; }

boolean showPointPoly = true;
void pointPoly() { showPointPoly = true; }
void noPointPoly() { showPointPoly = false; }
void togglePointPoly() { showPointPoly = !showPointPoly; }

boolean simplifiedFunctions = false;
void simplify() { simplifiedFunctions = true; }
void noSimplify() { simplifiedFunctions = false; }
void toggleSimplify() { simplifiedFunctions = !simplifiedFunctions; }

boolean showSpan = false;
void span() { showSpan = true; }
void noSpan() { showSpan = false; }
void toggleSpan() { showSpan = !showSpan; }

boolean showAdditionals = true;
void additionals() { showAdditionals = true; }
void noAdditionals() { showAdditionals = false; }
void toggleAdditionals() { showAdditionals = !showAdditionals; }

boolean drawConnected = true;
void connect() { drawConnected = true; }
void noConnect() { drawConnected = false; }
void toggleConnect() { drawConnected = !drawConnected; }

boolean allowOffsetting = false;
void offsetting() { allowOffsetting = true; }
void noOffsetting() { allowOffsetting = false; }
void toggleOffsetting() { allowOffsetting = !allowOffsetting; }

boolean allowReordering = false;
void reorder() { allowReordering = true; }
void noReorder() { allowReordering = false; }
void toggleReorder() { allowReordering = !allowReordering; }

boolean resetAllowed = false;
void mayReset() { resetAllowed = true; }
void noReset() { resetAllowed = false; }
void toggleReset() { resetAllowed = !resetAllowed; }

boolean redrawOnMouseMove = false;
void redrawOnMove() { redrawOnMouseMove = true; }
void noRedrawOnMove() { redrawOnMouseMove = false; }
void toggleRedrawOnMove() { redrawOnMouseMove = !redrawOnMouseMove; }
/******************************************
 *
 * An HTML+JS 'drop in' for Processing, so
 * that sketches can be given conditional
 * code for interfacing with an on-page
 * JavaScript context without breaking the
 * Processing sketch in either Java/JS mode.
 *
 ******************************************/

/**
 * Style object
 */
abstract class StyleObject {
  String display;
}

/**
 * HTML element interface.
 */
abstract class HTMLElement {
  String innerHTML;
  StyleObject style;
  abstract String setAttribute(String name, String value);
  abstract void getAttribute(String name);
}

/**
 * DOM interface.
 */
interface Document {
  HTMLElement querySelector(String s);
  HTMLElement[] querySelectorAll(String s);
}

/**
 * Console object.
 */
abstract class Console {
  abstract void log(String s);
}

/**
 * JavaScript context object.
 */
abstract class JavaScript {
  Console console;
  Document document;
  abstract void setupClippingButton(PApplet sketch);
  abstract void handleMouseMoved(PApplet sketch, PolyBezierCurve p, int mx, int my);
}

/**
 * Bind JS reference.
 */
void bindJavaScript(JavaScript js) {
  javascript = js;
}

/***************************************************
 *                                                 *
 *         Placeholder code for moulding           *
 *                                                 *
 ***************************************************/

void startCurveMoulding(BezierCurve curve, float t) {}
void endCurveMoulding(BezierCurve curve) {}
void mouldCurve(BezierCurve curve, int mx, int my) {}
boolean testCurveMoulding(BezierCurve curve, int mx, int my) { return false; }
