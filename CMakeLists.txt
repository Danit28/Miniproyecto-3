cmake_minimum_required(VERSION 3.16)
project(EcosystemSimulation CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_SOURCE_DIR}/bin)

find_package(OpenMP REQUIRED)
find_package(Threads REQUIRED)

add_library(ecocore STATIC src/ecosystem.cpp)
target_include_directories(ecocore PUBLIC src)

add_executable(ecosystem_seq src/main_seq.cpp)
target_link_libraries(ecosystem_seq ecocore)

add_executable(ecosystem_omp src/main_omp.cpp)
target_link_libraries(ecosystem_omp ecocore OpenMP::OpenMP_CXX)

add_executable(ecosystem_pthreads src/main_pthreads.cpp)
target_link_libraries(ecosystem_pthreads ecocore Threads::Threads)

add_executable(gen_input tools/gen_input.cpp)
