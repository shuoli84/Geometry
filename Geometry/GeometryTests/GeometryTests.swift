//
//  GeometryTests.swift
//  GeometryTests
//
//  Created by LiShuo on 7/23/15.
//  Copyright (c) 2015 LiShuo. All rights reserved.
//

import UIKit
import XCTest
import Geometry

class GeometryTests: XCTestCase {
    func testSegment() {
        var s = Segment(p1: CGPointMake(0, 0), p2: CGPointMake(10, 0))
        XCTAssertEqual(s.project(CGPointMake(0, 10)), CGPointMake(0, 0))
        
        XCTAssertEqual(s.project(CGPointMake(5, 5)), CGPointMake(5, 0))
        
        s = Segment(p1: CGPointMake(0, 0), p2: CGPointMake(20, 20))
        XCTAssertEqual(s.project(CGPointMake(0, 5)), CGPointMake(2.5, 2.5))
        
        XCTAssert(s.contains(CGPointMake(5, 5)))
        XCTAssert(!s.contains(CGPointMake(5, 6)))
        XCTAssert(!Segment(p1: CGPointMake(10, 10), p2: CGPointMake(20, 20)).contains(CGPointMake(0, 0)))
        
        // a b c d
        // e f g h
        // i j k l
        // m n o p
        let a = CGPointMake(0, 0)
        let b = CGPointMake(10, 0)
        let c = CGPointMake(20, 0)
        let d = CGPointMake(30, 0)
        let e = CGPointMake(0, 10)
        let f = CGPointMake(10, 10)
        let g = CGPointMake(20, 10)
        let h = CGPointMake(30, 10)
        let i = CGPointMake(0, 20)
        let j = CGPointMake(10, 20)
        let k = CGPointMake(20, 20)
        let l = CGPointMake(30, 20)
        let m = CGPointMake(0, 30)
        let n = CGPointMake(10, 30)
        let o = CGPointMake(20, 30)
        let p = CGPointMake(30, 30)
        
        let am = Segment(p1:a, p2:m)
        let dp = Segment(p1:d, p2:p)
        
        XCTAssert(am.crossPoint(dp) == nil)
        
        let ck = Segment(p1:c, p2:k)
        XCTAssert(am.crossPoint(ck) == nil)
        
        let eo = Segment(p1:e, p2:o)
        let dm = Segment(p1:d, p2:m)
        XCTAssertEqual(eo.crossPoint(dm)!, j)
    }
    
    func testRect() {
        let rect = CGRectMake(10, 10, 10, 10)
        
        XCTAssert(rect.project(CGPointMake(0, 0)) == nil)
        XCTAssert(rect.project(CGPointMake(30, 0)) == nil)
        XCTAssert(rect.project(CGPointMake(0, 30)) == nil)
        XCTAssert(rect.project(CGPointMake(30, 30)) == nil)
        
        XCTAssertEqual(rect.project(rect.topLeft)!, rect.topLeft)
        XCTAssertEqual(rect.project(rect.bottomLeft)!, rect.bottomLeft)
        XCTAssertEqual(rect.project(rect.topRight)!, rect.topRight)
        XCTAssertEqual(rect.project(rect.bottomRight)!, rect.bottomRight)
        
        XCTAssertEqual(rect.project(CGPointMake(15, 0))!, CGPointMake(15, 10))
        XCTAssertEqual(rect.project(CGPointMake(0, 15))!, CGPointMake(10, 15))
        XCTAssertEqual(rect.project(CGPointMake(30, 15))!, CGPointMake(20, 15))
        XCTAssertEqual(rect.project(CGPointMake(15, 30))!, CGPointMake(15, 20))
        
        XCTAssertEqual(rect.closestPointTo(CGPointMake(0, 0)), CGPointMake(10, 10))
        XCTAssertEqual(rect.closestPointTo(CGPointMake(30, 0)), CGPointMake(20, 10))
        XCTAssertEqual(rect.closestPointTo(CGPointMake(0, 30)), CGPointMake(10, 20))
        XCTAssertEqual(rect.closestPointTo(CGPointMake(30, 30)), CGPointMake(20, 20))
    }
}
