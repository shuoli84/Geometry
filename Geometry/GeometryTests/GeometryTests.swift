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
    
    override func setUp() {
        super.setUp()
        // Put setup code here. This method is called before the invocation of each test method in the class.
    }
    
    override func tearDown() {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
        super.tearDown()
    }
    
    func testSegment() {
        var s = Segment(p1: CGPointMake(0, 0), p2: CGPointMake(10, 0))
        XCTAssertEqual(s.project(CGPointMake(0, 10)), CGPointMake(0, 0))
        
        XCTAssertEqual(s.project(CGPointMake(5, 5)), CGPointMake(5, 0))
        
        s = Segment(p1: CGPointMake(0, 0), p2: CGPointMake(20, 20))
        XCTAssertEqual(s.project(CGPointMake(0, 5)), CGPointMake(2.5, 2.5))
        
        XCTAssert(s.contains(CGPointMake(5, 5)))
        XCTAssert(!s.contains(CGPointMake(5, 6)))
        XCTAssert(!Segment(p1: CGPointMake(10, 10), p2: CGPointMake(20, 20)).contains(CGPointMake(0, 0)))
    }
    
    func testPerformanceExample() {
        // This is an example of a performance test case.
        self.measureBlock() {
            // Put the code you want to measure the time of here.
        }
    }
    
}
