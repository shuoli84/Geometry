import Foundation
import UIKit

public extension CGRect {
    public var topLeft: CGPoint {
        get {
            return CGPointMake(minX, minY)
        }
    }
    
    public var bottomLeft: CGPoint {
        get {
            return CGPointMake(minX, maxY)
        }
    }
    
    public var topRight: CGPoint {
        get {
            return CGPointMake(maxX, minY)
        }
    }
    
    public  var bottomRight: CGPoint {
        get {
            return CGPointMake(maxX, maxY)
        }
    }
   
    public var leftSegment: Segment {
        get {
            return Segment(p1: topLeft, p2: bottomLeft)
        }
    }
    
    public var topSegment: Segment {
        get {
            return Segment(p1: topLeft, p2: topRight)
        }
    }
    
    public var rightSegment: Segment {
        get {
            return Segment(p1: topRight, p2: bottomRight)
        }
    }
    
    public var bottomSegment: Segment {
        get {
            return Segment(p1: bottomLeft, p2: bottomRight)
        }
    }
    
    public func closestPointTo(point: CGPoint) -> CGPoint {
        if let point = project(point) {
            return point
        }
        
        return point.closestPoint([topLeft, topRight, bottomLeft, bottomRight])!
    }
    
    public func project(point: CGPoint) -> CGPoint? {
        let projectedPoints = [topSegment, leftSegment, bottomSegment, rightSegment]
            .filter { $0.contains($0.project(point)) }
            .map {$0.project(point)}
        if projectedPoints.count == 0 {
            return nil
        }
        
        var closestPoint: CGPoint!
        var shortestDistance: CGFloat = CGFloat.infinity
        for p in projectedPoints {
            if p.distance(point) < shortestDistance {
                shortestDistance = p.distance(point)
                closestPoint = p
            }
        }
        
        return closestPoint
    }
    
    public func segmentsContainsPoint(point: CGPoint) -> [Segment] {
        return [topSegment, leftSegment, bottomSegment, rightSegment].filter {$0.contains(point)}
    }
}