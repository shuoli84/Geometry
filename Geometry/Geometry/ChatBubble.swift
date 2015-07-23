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