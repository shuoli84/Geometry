import Foundation
import UIKit

public struct Circle: Printable {
    public var center: CGPoint
    public var radius: CGFloat
    
    public var description: String {
        get {
            return "Circle(c:\(center) r: \(radius))"
        }
    }
    
    public init(center: CGPoint, radius: CGFloat) {
        self.center = center
        self.radius = radius
    }
    
    public var area: CGFloat {
        get {
            return CGFloat(M_PI) * radius * radius
        }
    }
    
    public var perimeter: CGFloat {
        get {
            return 2 * CGFloat(M_PI) * radius
        }
    }
    
    public func path() -> UIBezierPath {
        return UIBezierPath(ovalInRect: CGRectMake(center.x - radius, center.y - radius, 2 * radius, 2 * radius))
    }
    
    public func pointsSplitedEvenly(count: Int, startAngle: CGFloat = 0, clockWise: Bool = true) -> [CGPoint] {
        if count <= 1 {
            return []
        }
        
        let angleStep = CGFloat(M_PI * 2) / CGFloat(count)
        
        var points: [CGPoint] = []
        for index in 0..<count {
            let angle = startAngle + CGFloat(index) * angleStep * (clockWise ? 1 : -1)
            points.append(CGPointMake(self.center.x + radius * cos(angle), self.center.y + radius * sin(angle)))
        }
        return points
    }

}
