Pod::Spec.new do |s|
  s.name         = 'LXNativeModules'
  s.version      = '1.0.0'
  s.summary      = 'LX Music iOS native modules bridge'
  s.homepage     = 'https://github.com/lyswhut/lx-music-mobile'
  s.license      = { :type => 'Apache-2.0' }
  s.author       = { 'lx-music-ios' => 'noreply@example.com' }
  s.platform     = :ios, '16.1'
  s.source       = { :path => '.' }
  s.source_files = '**/*.{m,mm,h,swift}'
  s.frameworks   = 'UIKit', 'Foundation', 'AVFoundation', 'MediaPlayer', 'CryptoKit', 'UserNotifications', 'SystemConfiguration'
  s.weak_frameworks = 'ActivityKit'
  s.requires_arc = true
  s.swift_version = '5.0'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }

  s.dependency 'React-Core'
end
