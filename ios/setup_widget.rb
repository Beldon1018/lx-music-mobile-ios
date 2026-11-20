#!/usr/bin/env ruby
# 在 CI 构建时自动为工程添加 lyricWidget (Widget Extension) target。
# 使用 xcodeproj gem 可靠地修改 pbxproj，避免手工编辑出错。
# 幂等：若 target 已存在则跳过。

require 'xcodeproj'

project_path = File.expand_path('LxMusicMobile.xcodeproj', __dir__)
project = Xcodeproj::Project.open(project_path)

TARGET_NAME = 'lyricWidget'
if project.targets.any? { |t| t.name == TARGET_NAME }
  puts "[setup_widget] target #{TARGET_NAME} 已存在，跳过"
  exit 0
end

app_target = project.targets.find { |t| t.name == 'LxMusicMobile' }
abort '[setup_widget] 找不到 LxMusicMobile target' unless app_target

# 创建 app extension target
widget = project.new_target(:app_extension, TARGET_NAME, :ios, '16.1')

# 添加源码文件
widget_dir = File.expand_path('lyricWidget', __dir%)
['LyricWidget.swift', 'LyricLiveActivityAttributes.swift'].each do |file|
  ref = project.new_file(File.join(widget_dir, file))
  widget.add_file_references([ref])
end

# 配置构建设置
widget.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'cn.toside.music.mobile.lyricWidget'
  config.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
  config.build_settings['INFOPLIST_FILE'] = 'lyricWidget/Info.plist'
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.1'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
  config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
  config.build_settings['SKIP_INSTALL'] = 'NO'
end

# 让主 app 嵌入 widget（Embed App Extensions 构建阶段）
begin
  embed_phase = app_target.new_copy_files_build_phase('Embed App Extensions')
  embed_phase.dst_subfolder_spec = '13' # PlugIns
  widget_ref = project.main_group.new_reference('lyricWidget')
  file_ref = widget.product_reference
  build_file = embed_phase.add_file_reference(file_ref)
  build_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
rescue => e
  warn "[setup_widget] 嵌入阶段添加警告: #{e.message}"
end

project.save(project_path)
puts "[setup_widget] #{TARGET_NAME} target 已创建并保存"
