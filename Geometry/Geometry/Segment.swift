import Foundation
import UIKit

public struct Segment: Printable {
    public var p1: CGPoint
    public var p2: CGPoint
    
    public var description: String {
        get {
            return "\(NSStringFromCGPoint(p1)) -- \(NSStringFromCGPoint(p2))"
        }
    }
    
    public init(p1: CGPoint, p2: CGPoint) {
        self.p1 = p1
        self.p2 = p2
    }
    
    public var length: CGFloat {
        get {
            return p1.distance(p2)
        }
    }
    
    public var angle: CGFloat {
        get {
            return atan2(p2.y - p1.y, p2.x - p1.x)
        }
    }
    
    public func path() -> UIBezierPath {
        var path = UIBezierPath()
        path.moveToPoint(p1)
        path.addLineToPoint(p2)
        return path
    }
    
    public func project(point: CGPoint) -> CGPoint {
        let x1 = p1.x, y1 = p1.y
        let x2 = p2.x, y2 = p2.y
        let xp = point.x, yp = point.y
        
        let result: CGPoint
        
        if (y2 - y1) == 0 {
            result = CGPointMake(xp, y1)
        }
        else if (x2 - x1) == 0{
            result = CGPointMake(x1, yp)
        }
        else {
            let a = (x2 - x1) / (y2 - y1)
            let y = (a * xp + yp + a * x1 + a * a * y1)  / (1 + a * a)
            let x = a * (y - y1) + x1
            result = CGPointMake(x, y)
        }
        
        return result
    }
    
    public func contains(point: CGPoint) -> Bool {
        return point.distance(p1) + point.distance(p2) == self.length
    }
    
    public func crossPoint(another: Segment) -> CGPoint? {
        let x1 = p1.x, y1 = p1.y
        let x2 = p2.x, y2 = p2.y
        let x3 = another.p1.x, y3 = another.p1.y
        let x4 = another.p2.x, y4 = another.p2.y
        
        let x: CGFloat, y: CGFloat
        
        if (y2 == y1) && (y4 == y3) || (x2 == x1) && (x4 == x3) {
            return nil
        }
        else if (y2 == y1) {
            y = y1
            x = x3 + (y1 - y3) * (x4 - x3) / (y4 - y3)
        }
        else if (y4 == y3) {
            y = y3
            x = x1 + (y3 - y1) * (x2 - x1) / (y2 - y1)
        }
        else if (x4 == x3) {
            x = x3
            y = y1 + (y2 - y1) * (x3 - x1) / (x2 - x1)
        }
        else if (x2 == x1) {
            x = x2
            y = y3 + (y4 - y3) * (x2 - x3) / (x4 - x3)
        }
        else if (x4 - x3) * (y2 - y1) == (y4 - y3) * (x2 - x1) {
            return nil
        }
        else {
            let a = (y2 - y1) / (x2 - x1)
            let c = (y4 - y3) / (x4 - x3)
            let b = (x2 * y1 - x1 * y2) / (x2 - x1)
            let d = (x4 * y3 - x3 * y4) / (x4 - x3)
            
            x = (d - b) / (a - c)
            y = a * x + b
        }
        
        let point = CGPointMake(x, y)
        if self.contains(point) && another.contains(point) {
            return point
        }
        
        return nil
    }
    
    public func pointByDistance(var distance: CGFloat, limitOnSegment: Bool = true) -> CGPoint {
        if limitOnSegment {
            distance = min(max(distance, 0), length)
        }
        
        return CGPointMake(p1.x + (distance / self.length) * (p2.x - p1.x), p1.y + (distance / self.length) * (p2.y - p1.y))
    }
    
    public func segmentByDistance(distance: CGFloat, offset: CGFloat = 0) -> Segment {
        return Segment(p1: pointByDistance(0), p2: pointByDistance(distance + offset))
    }
    
    public func split(point: CGPoint, allowEmpty: Bool = false, startFromPoint: Bool = false) -> [Segment] {
        if contains(point) {
            let segments = [startFromPoint ? Segment(p1: point, p2: p1) : Segment(p1: p1, p2: point), Segment(p1: point, p2: p2)]
            if !allowEmpty {
                return segments.filter {$0.length > 0}
            }
            return segments
        }
        return []
    }
    
    public func segmentByRotate(point: CGPoint, angle: CGFloat) -> Segment {
        return Segment(p1: p1.pointByRotate(point, angle: angle), p2: p2.pointByRotate(point, angle: angle))
    }
}