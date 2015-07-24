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
        if points.count == 2 {
            return Triangle(p1: tailSegment.p2, p2:points[0][0], p3: points[1][0]) // FIXME no hard index
        }
        return Triangle(p1: CGPointZero, p2: CGPointZero, p3: CGPointZero)
    }
}

// Container rect's origin should be 0
public func positionRectInRectCloseToPoint(rectToBePlaced: CGRect, containerRect: CGRect, point: CGPoint, margin: CGFloat, space: CGFloat) -> CGRect {
    let height = rectToBePlaced.height + space
    var y: CGFloat
    
    if point.y - margin - space >= height {
        y = point.y - space - height
    }
    else {
        y = point.y + space
    }
    
    y = min(max(y, margin), containerRect.height - margin - rectToBePlaced.height)
    var x = point.x - rectToBePlaced.width / 2
    
    x = min(max(x, margin), containerRect.width - margin - rectToBePlaced.width)
    return CGRectMake(x, y, rectToBePlaced.width, rectToBePlaced.height)
}