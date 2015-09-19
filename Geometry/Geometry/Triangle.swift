import Foundation
import UIKit

public struct Triangle: CustomStringConvertible {
    public var p1: CGPoint
    public var p2: CGPoint
    public var p3: CGPoint
    
    public init(p1: CGPoint, p2: CGPoint, p3: CGPoint) {
        self.p1 = p1
        self.p2 = p2
        self.p3 = p3
    }
    
    public func path() -> UIBezierPath {
        let p = UIBezierPath()
        p.moveToPoint(p1)
        p.addLineToPoint(p2)
        p.addLineToPoint(p3)
        p.closePath()
        return p
    }
    
    public var description: String {
        get {
            return "\([p1, p2, p3].map {NSStringFromCGPoint($0)})"
        }
    }
    
    public var perimeter: CGFloat {
        get {
            return p1.distance(p2) + p2.distance(p3) + p3.distance(p1)
        }
    }
    
    public var area: CGFloat {
        get {
            let s = perimeter / 2
            return sqrt(s * (s - p1.distance(p2)) * (s - p2.distance(p3)) * (s - p3.distance(p1)))
        }
    }
}