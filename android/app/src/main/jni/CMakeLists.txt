cmake_minimum_required(VERSION 3.13)

# React Native's default app setup, plus the shared C++ TurboModule
# (shared/NativeRoundTripCxx.cpp). OnLoad.cpp in this folder replaces the
# default one so it can register that module.
project(appmodules)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

target_sources(${CMAKE_PROJECT_NAME} PRIVATE ../../../../../shared/NativeRoundTripCxx.cpp)
target_include_directories(${CMAKE_PROJECT_NAME} PUBLIC ../../../../../shared)
