import Foundation
import UIKit

public extension CGFloat {
    public func roundedTo(unit: CGFloat) -> CGFloat {
        return round(self / unit) * unit
    }
}