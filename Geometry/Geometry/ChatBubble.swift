import Foundation
import UIKit

//   --------
//   | rect |
//   --------  -
//      \/     | height
//             -
//
//      point
public func bubbleTailSegment(rect: CGRect, point: CGPoint, height: CGFloat ) -> Segment {
    return Segment(p1: rect.closestPointTo(point), p2: point).segmentByDistance(height, offset: 0)
}

public func tailTriangleForBubble(rect: CGRect, point: CGPoint, height: CGFloat) -> Triangle {
    let distance: CGFloat = height / sqrt(3)
    let tailSegment = bubbleTailSegment(rect, point, height)
    // p1 of the segment are on rect
    let pointOnRect = tailSegment.p1
    let segments = rect.segmentsContainsPoint(pointOnRect)
    
    if segments.count == 1 {
        let segments = segments[0].split(pointOnRect, startFromPoint: true).map {
            (item: Segment) -> Segment in
            return item.segmentByDistance(distance, offset: 0)
        }
        
        return Triangle(p1: segments[0].p2, p2: segments[1].p2, p3: tailSegment.p2)
    }
    else {
        let points = segments.map { $0.split(pointOnRect, startFromPoint: true).filter {$0.length > 0.0001}.map {$0.pointByDistance(distance)} }
        return Triangle(p1: tailSegment.p2, p2:points[0][0], p3: points[1][0]) // FIXME no hard index
    }
}