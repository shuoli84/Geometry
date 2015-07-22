import Foundation
import UIKit

public extension CGPoint {
    func distance(point: CGPoint) -> CGFloat {
        return sqrt((point.y - y) * (point.y - y) + (point.x - x) * (point.x - x))
    }
}

public struct Segment {
    var p1: CGPoint
    var p2: CGPoint
    
    public init(p1: CGPoint, p2: CGPoint) {
        self.p1 = p1
        self.p2 = p2
    }
    
    public var length: CGFloat {
        get {
            return p1.distance(p2)
        }
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
}
