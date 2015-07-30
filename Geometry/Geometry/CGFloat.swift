import Foundation
import UIKit

public extension CGFloat {
    public func roundedTo(unit: CGFloat) -> CGFloat {
        return round(self / unit) * unit
    }
    
    public func between(min: CGFloat, _ max: CGFloat) -> Bool {
        return self >= min && self <= max
    }
    
    public func clamp(min: CGFloat, _ max: CGFloat) -> CGFloat {
        if self < min { return min }
        if self > max { return max }
        return self
    }
}