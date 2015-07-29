import Foundation
import UIKit

public extension CGPoint {
    func distance(point: CGPoint) -> CGFloat {
        return sqrt((point.y - y) * (point.y - y) + (point.x - x) * (point.x - x))
    }
    
    func closestPoint(points: [CGPoint]) -> CGPoint? {
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
    
    func rounded(unit: CGFloat = 0.01) -> CGPoint {
        return CGPointMake(x.roundedTo(unit), y.roundedTo(unit))
    }
}

extension CGPoint: Printable {
    public var description: String {
        get {
            return NSStringFromCGPoint(self)
        }
    }
}

extension UIBezierPath {
    static func poligonByPoints(points: [CGPoint]) -> UIBezierPath {
        var path = UIBezierPath()
        
        if points.count == 0 {
            return path
        }
        
        path.moveToPoint(points[0])
        points[1..<points.endIndex].map { path.addLineToPoint($0) }
        path.closePath()
        return path
    }
}