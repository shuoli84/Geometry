import Foundation
import UIKit

public struct Arc {
    public var start: CGFloat
    public var end: CGFloat
    public var clockwise: Bool
    
    public var circle: Circle
    
    public init(circle: Circle, start: CGFloat, end: CGFloat, clockwise: Bool) {
        self.circle = circle
        self.start = start
        self.end = end
        self.clockwise = clockwise
    }
    
    public var angle: CGFloat {
        get {
            return (end - start) % CGFloat(M_PI * 2)
        }
    }
    
    public var startPoint: CGPoint {
        get {
            return circle.pointAtAngle(start)
        }
    }
    
    public var endPoint: CGPoint {
        get {
            return circle.pointAtAngle(end)
        }
    }
    
    public func edgeSegments() -> (Segment, Segment) {
        return (
            Segment(circle.center, startPoint),
            Segment(circle.center, endPoint))
    }
    
    public func path() -> UIBezierPath {
        let path = UIBezierPath(arcCenter: circle.center, radius: circle.radius, startAngle: start, endAngle: end, clockwise: clockwise)
        return path
    }
    
    public func closestPointTo(point: CGPoint) -> CGPoint {
        let pointAngle = Segment(circle.center, point).angle
            
        if angleBetweenAngles(pointAngle, start: start, end: end, clockwise: clockwise) {
            return circle.closestPointTo(point)
        }
        
        let p1 = startPoint
        let p2 = endPoint
        
        return p1.distance(point) <= p2.distance(point) ? p1 : p2
    }
}

public func angleBetweenAngles(angle: CGFloat, start: CGFloat, end: CGFloat, clockwise: Bool) -> Bool {
    let point2Start = angleNormalizeToZeroToTwoPI(clockwise ? angle - start : start - angle)
    let end2Point = angleNormalizeToZeroToTwoPI(clockwise ? end - angle: angle - end)
    let end2start = angleNormalizeToZeroToTwoPI(clockwise ? end - start: start - end)
    
    return point2Start + end2Point == end2start
}

public func angleNormalizeToZeroToTwoPI(angle: CGFloat) -> CGFloat {
    let result = angle % CGFloat(M_PI * 2)
    return result < 0 ? result + CGFloat(2 * M_PI) : result
}

public struct Pie {
    public var arc: Arc
    
    public init(arc: Arc) {
        self.arc = arc
    }
    
    public var area: CGFloat {
        get {
            // return arc.circle.area * abs(arc.angle) / (CGFloat(M_PI * 2))
            return 0
        }
    }
    
    public func path() -> UIBezierPath {
        let path = UIBezierPath()
        
        path.moveToPoint(arc.circle.center)
        path.addLineToPoint(arc.circle.pointAtAngle(arc.start))
        path.addArcWithCenter(arc.circle.center, radius: arc.circle.radius, startAngle: arc.start, endAngle: arc.end, clockwise: arc.clockwise)
        path.addLineToPoint(arc.circle.pointAtAngle(arc.end))
        path.closePath()
        
        return path
    }
    
    public func cloestPoint(point: CGPoint) -> CGPoint {
        let p1 = arc.closestPointTo(point)
        
        let segments = arc.edgeSegments()
        
        let p2 = segments.0.closestPoint(point)
        let p3 = segments.1.closestPoint(point)
        
        let p = p1.distance(point) <= p2.distance(point) ? p1 : p2
        return p.distance(point) <= p1.distance(point) ? p : p1
    }
}