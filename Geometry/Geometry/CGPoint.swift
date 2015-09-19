import Foundation
import UIKit

public extension CGPoint {
    @inline(__always)
    public func distance(point: CGPoint) -> CGFloat {
        return sqrt((point.y - y) * (point.y - y) + (point.x - x) * (point.x - x))
    }
    
    public func closestPoint(points: [CGPoint]) -> CGPoint? {
        if points.count == 0 {
            return nil
        }
        
        return points.reduce((nil, CGFloat.infinity), combine: {
            (result: (CGPoint?, CGFloat), p: CGPoint) in
            if self.distance(p) < result.1 {
                return (p, self.distance(p))
            }
            return result
        }).0!
    }
    
    public func pointByRotate(center: CGPoint, angle: CGFloat) -> CGPoint {
        return pointByTranslate(-center.x, y: -center.y).pointByRotateAroundOrigin(angle).pointByTranslate(center.x, y: center.y)
    }
    
    @inline(__always)
    public func pointByTranslate(x: CGFloat, y: CGFloat) -> CGPoint {
        return CGPointMake(self.x + x, self.y + y)
    }
    
    public func pointByRotateAroundOrigin(angle: CGFloat) -> CGPoint {
        let currentAngle = atan2(self.y, self.x)
        let newAngle = currentAngle + angle
        let distance = self.distance(CGPointZero)
        return CGPointMake(distance * cos(newAngle), distance * sin(newAngle))
    }
    
    public func rounded(unit: CGFloat = 0.01) -> CGPoint {
        return CGPointMake(x.roundedTo(unit), y.roundedTo(unit))
    }
}

extension CGPoint: CustomStringConvertible {
    public var description: String {
        get {
            return NSStringFromCGPoint(self)
        }
    }
}

extension UIBezierPath {
    static func poligonByPoints(points: [CGPoint]) -> UIBezierPath {
        let path = UIBezierPath()
        
        if points.count == 0 {
            return path
        }
        
        path.moveToPoint(points[0])
        Array(points[1..<points.endIndex].map { path.addLineToPoint($0) })
        path.closePath()
        return path
    }
}