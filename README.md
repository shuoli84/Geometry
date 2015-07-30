Geometry for swift
======
Geometry for human

Motivation
---
When human draws, we think about relations, when machine draws, it saws points. 

Example
---
Create a star

``` swift
let center = CGPointMake(100, 100)
let circle = Circle(center: center, radius: 50)

let points = circle.pointsSplitedEvenly(5)
let reorderedPoints = indices(points).map {points[ $0 * 2 % points.count ]}

path = UIBezierPath.poligonByPoints(reorderedPoints) // Now the path is a star
```

CGPoint
---

| name | def | description |
| ------------- | ----------- | ---------- |
| distance | func distance(anotherPoint: CGPoint) -> CGFloat | Return the distance between current point and anotherPoint |
| closestPoint | func closestPoint(points: [CGPoint]) -> CGPoint | Return the closest point |
| pointByRotate | func pointByRotate(center: CGPoint, angle: CGFloat) -> CGPoint | Return the point rotated around center |
| rounded | func rounded(unit: CGFloat) -> CGPoint | Round point to unit, (0.123, 0.282).rounded(unit: 0.1) -> (0.1, 0.3) |

Segment
---
Segment is defined by two points. 

| name | def | description |
| ------------- | ----------- | ---------- |
| init | init(p1: CGPoint, p2: CGPoint) ||
| length | var length: CGFloat | Length of the segment |
| angle | var angle: CGFloat | Angle of the segment. Segment((0, 0), (1, 1)).angle = - PI/4 |
| project | func project(point: CGPoint) -> CGPoint | Get the point project to the Line defined by Segment. |
| contains | func contains(point: CGPoint) -> Bool | Whether the segment contains point |
| crossPoint | func crossPoint(another: Segment) -> CGPoint? | Return the cross point of two segments if exists, otherwise nil |
| pointByDistance | func pointByDistance(distance: CGFloat, limitOnSegment: Bool) -> CGPoint | Get the point on segment with certain distance to p1 |
| segmentByDistance | func segmentByDistance(distance: CGFloat, offset: CGFloat) -> Segment | Get the sub segement which has length of distance |
| segmentByRotate | func segmentByRotate(point: CGPoint, angle: CGFloat) -> Segment | Get the segment rotated around center by angle |

CGRect
---
Extension functions for CGRect

| name | def | description |
| ------------- | ----------- | ---------- |
| center, topLeft, bottomLeft, topRight, bottomRight | CGPoint | Some special point for CGRect |
| leftSegment, rightSegment, topSegment, bottomSegment | Segment | Four segment for Rect |
| closestpoint | func closestpoint(point: CGPoint) -> CGPoint | Get the cloest point to argument on rect |
| project | func project(point: CGPoint) -> CGPoint? | Get point projected to rect |
| segemntsContainsPoint | func segmentsContainsPoint(point: CGPoint) -> [Segment] | Get all segements containing the point |

Circle
---
Circle is defined by center and radius

| name | def | description |
| ------------- | ----------- | ---------- |
| area | var area: CGFloat | The area of circle |
| pointsSplitedEvenly | func pointsSplitedEvently(count: Int, startAngle: CGFloat, clockwise: Bool) -> [CGPoint] | Get all points split evenly by count|
| cloestPointTo | func cloestPointTo(point: CGPoint) -> CGPoint | Get the cloest point to argumented point |
| pointAtAngle | func pointAtAngle(angle: CGFloat) -> CGPoint | Get the point at angle on circle |

Arc
---
Arc is defined by a circle, start, end angle and clockwise.

| name | def | description |
| ------------- | ----------- | ---------- |
| startPoint, endPoint | CGPoint | The points for start and end |
| edgeSegments | func edgeSegments() -> (Segment, Segment) | Two segments from circle's center to start point and end point |
| cloestPointTo | func cloestPointTo(point: CGPoint) -> CGPoint | Get the cloest point to argumented point |

Pie
---
Pie is defined by Arc

| name | def | description |
| ------------- | ----------- | ---------- |
| TBD | | |

Triangle
---
Triangle is defined by three points


License
---
MIT
